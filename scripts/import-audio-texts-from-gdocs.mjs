import { createClient } from "@supabase/supabase-js";

/**
 * Configuração dos documentos do Google Docs que serão importados.
 * Ajuste / adicione entradas conforme necessário.
 */
const DOCS = [
  {
    id: "10GmEnB76ukJI4WG0ZWJDRmsK0ATtYxm3RlJRpn75_vE",
    level: "A1",
    seq: 1,
  },
  {
    id: "1N-U8y_Lq76Of1O2Zpebn4cE1DTwBuE38iUuRszuAsFI",
    level: "A1",
    seq: 2,
  },
];

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Env ${name} não encontrado. Defina ${name} antes de rodar o import.`);
  }
  return value;
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error("Defina SUPABASE_URL ou VITE_SUPABASE_URL para rodar o import.");
}
ensureEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchDocText(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao baixar doc ${docId}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function parseDoc(raw, fallback) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, idx, arr) => !(l === "" && idx > 0 && arr[idx - 1] === ""));

  const headerLine = lines.find((l) => l.startsWith("Nível ")) ?? "";
  let theme = fallback.theme ?? "";
  if (headerLine.includes(":")) {
    const afterColon = headerLine.split(":")[1]?.trim();
    if (afterColon) theme = afterColon;
  }

  const titleLine = lines.find((l) => l.startsWith("Título da Cena:")) ?? "";
  let title = fallback.title ?? "";
  let title_pt = fallback.title_pt ?? "";
  const m = titleLine.match(/^Título da Cena:\s*(.+?)\s*\((.+)\)/);
  if (m) {
    title = m[1].trim();
    title_pt = m[2].trim();
  }

  const idxEstudo = lines.findIndex((l) => l.startsWith("3. ESTUDO ATIVO"));
  const idxAnalise = lines.findIndex((l, idx) => idx > idxEstudo && l.startsWith("4."));

  if (idxEstudo === -1) {
    throw new Error("Seção '3. ESTUDO ATIVO' não encontrada no documento.");
  }

  const section = lines.slice(
    idxEstudo + 1,
    idxAnalise > idxEstudo ? idxAnalise : undefined,
  );

  const sentences = [];
  for (let i = 0; i < section.length; i++) {
    const enLine = section[i].trim();
    if (!enLine || enLine.startsWith("(")) continue;

    let ptLine = "";
    let j = i + 1;
    while (j < section.length) {
      const candidate = section[j].trim();
      if (candidate.startsWith("(")) {
        ptLine = candidate;
        break;
      }
      if (candidate === "") break;
      j++;
    }

    const en = enLine.replace(/^["“]/, "").replace(/["”]\s*$/, "");
    const pt = ptLine.replace(/^\(/, "").replace(/\)\s*$/, "");

    sentences.push({ en, pt });

    if (ptLine) {
      i = j;
    }
  }

  if (sentences.length === 0) {
    throw new Error("Nenhuma frase encontrada na seção de Estudo Ativo.");
  }

  const wordCount = sentences.reduce(
    (acc, s) => acc + s.en.split(/\s+/).filter(Boolean).length,
    0,
  );
  const minutes = wordCount / 140;
  const totalSeconds = Math.max(30, Math.round(minutes * 60));
  const mm = Math.floor(totalSeconds / 60);
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  const duration = `${mm}:${ss}`;

  return { theme, title, title_pt, sentences, duration };
}

async function upsertText({ level, seq, docId }) {
  console.log(`\n=== Importando doc ${docId} (level ${level}, seq ${seq}) ===`);
  const raw = await fetchDocText(docId);
  const parsed = parseDoc(raw, { theme: "", title: "", title_pt: "" });

  console.log(`Título: ${parsed.title} (${parsed.title_pt})`);
  console.log(`Tema: ${parsed.theme}`);
  console.log(`Frases: ${parsed.sentences.length}`);

  const { data: textRow, error: textErr } = await supabase
    .from("audio_texts")
    .insert({
      title: parsed.title || `Text ${seq}`,
      title_pt: parsed.title_pt || parsed.title || `Texto ${seq}`,
      level,
      theme: parsed.theme || level,
      seq,
      duration: parsed.duration,
    })
    .select("*")
    .single();

  if (textErr || !textRow) {
    console.error("Erro ao inserir audio_text:", textErr);
    return;
  }

  const payload = parsed.sentences.map((s, idx) => ({
    text_id: textRow.id,
    seq: idx + 1,
    en: s.en,
    pt: s.pt || s.en,
  }));

  const { error: sentErr } = await supabase
    .from("audio_text_sentences")
    .insert(payload);

  if (sentErr) {
    console.error("Erro ao inserir frases:", sentErr);
  } else {
    console.log(`Import concluído para "${parsed.title}"`);
  }
}

async function main() {
  for (const doc of DOCS) {
    try {
      await upsertText({
        level: doc.level,
        seq: doc.seq,
        docId: doc.id,
      });
    } catch (e) {
      console.error(
        `Falha ao processar doc ${doc.id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

