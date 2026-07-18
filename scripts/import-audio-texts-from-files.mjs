import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const ROOT_DIR = new URL("..", import.meta.url).pathname;
const TEXTS_ROOT = path.join(ROOT_DIR, "texts");

function requireEnv(name) {
  const value =
    process.env[name] ??
    (name === "SUPABASE_URL" ? process.env.VITE_SUPABASE_URL : undefined);
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não encontrada. Defina ${name} em .env.import.`,
    );
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── File discovery ───────────────────────────────────────────────────────────

function listTextFiles() {
  if (!fs.existsSync(TEXTS_ROOT)) {
    throw new Error(
      `Pasta de textos não encontrada: ${TEXTS_ROOT}. Crie essa pasta e coloque os .txt lá.`,
    );
  }
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) out.push(p);
    }
  };
  walk(TEXTS_ROOT);
  return out;
}

function parseFileName(filePath) {
  const base = path.basename(filePath, ".txt");
  const match = base.match(/^([A-Za-z]\d)_?(\d+)_?(.*)$/);
  if (!match) {
    return { level: "A1", seq: 1, slug: base };
  }
  const [, levelRaw, seqRaw, rest] = match;
  const level = levelRaw.toUpperCase();
  const seq = parseInt(seqRaw, 10) || 1;
  const slug = rest.replace(/_/g, " ").trim();
  return { level, seq, slug };
}

// ─── Raw text normalisation ───────────────────────────────────────────────────

function normaliseLines(raw) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, idx, arr) => !(l === "" && idx > 0 && arr[idx - 1] === ""));
}

/** Find the 1-based index of the first line that starts with a given prefix (case-insensitive). */
function findSection(lines, prefix) {
  return lines.findIndex((l) => l.toUpperCase().startsWith(prefix.toUpperCase()));
}

/** Slice lines between two section indices (exclusive of section header lines). */
function sectionLines(lines, startIdx, endIdx) {
  if (startIdx === -1) return [];
  const end = endIdx > startIdx ? endIdx : lines.length;
  return lines.slice(startIdx + 1, end);
}

// ─── Section parsers ─────────────────────────────────────────────────────────

/** Seção 2: TEXTO FLUÍDO - PT-BR (parágrafo completo). */
function parseSectionPtText(lines) {
  const start = findSection(lines, "2. TEXTO FLUÍDO - PT-BR");
  const end = findSection(lines, "3. ESTUDO ATIVO");
  const block = sectionLines(lines, start, end).filter(Boolean);
  return block.join("\n");
}

/** Seção 3: ESTUDO ATIVO — frases EN + tradução PT linha por linha. */
function parseSectionSentences(lines) {
  const start = findSection(lines, "3. ESTUDO ATIVO");
  const end = findSection(lines, "4.");
  const section = sectionLines(lines, start, end);

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
      if (candidate !== "" && !candidate.startsWith("(")) break;
      j++;
    }

    const en = enLine.replace(/^[""]/, "").replace(/[""]$/, "").trim();
    const pt = ptLine.replace(/^\(/, "").replace(/\)\s*$/, "").trim();

    sentences.push({ en, pt });
    if (ptLine) i = j;
  }

  if (sentences.length === 0) {
    throw new Error("Nenhuma frase encontrada na seção de Estudo Ativo.");
  }
  return sentences;
}

/**
 * Seção 4: ANÁLISE BILÍNGUE — frases/expressões com tradução e explicação.
 * Formato: - Expressão. | Tradução (Explicação opcional).
 */
function parseSectionPhrases(lines) {
  const start = findSection(lines, "4. ANÁLISE BILÍNGUE");
  const end = findSection(lines, "5. TOOLKIT GRAMATICAL");
  const section = sectionLines(lines, start, end);

  const phrases = [];
  for (const line of section) {
    if (!line.startsWith("- ")) continue;
    const parts = line.substring(2).split("|");
    if (parts.length < 2) continue;

    const phrase = parts[0].trim().replace(/\.\s*$/, "");
    let rest = parts.slice(1).join("|").trim();
    let translation = rest;
    let explanation = null;

    // Check for optional (explanation) at the end
    const expMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*\.?\s*$/);
    if (expMatch) {
      translation = expMatch[1].trim().replace(/\.\s*$/, "");
      explanation = expMatch[2].trim();
    }
    translation = translation.replace(/\.\s*$/, "");

    phrases.push({ phrase, translation, explanation });
  }
  return phrases;
}

/**
 * Seção 5: TOOLKIT GRAMATICAL — dicas gramaticais.
 * Formato: TÍTULO: conteúdo (pode ter sub-bullets)
 */
function parseSectionTips(lines) {
  const start = findSection(lines, "5. TOOLKIT GRAMATICAL");
  const end = findSection(lines, "6. VOCABULÁRIO ESSENCIAL");
  const section = sectionLines(lines, start, end);

  const tips = [];
  let current = null;

  for (const line of section) {
    if (!line) continue;

    // A tip title is an ALL_CAPS word or phrase followed by a colon
    const titleMatch = line.match(/^([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]+):\s*(.*)/);
    if (titleMatch) {
      // Save any previous tip
      if (current) tips.push(current);
      current = {
        title: titleMatch[1].trim(),
        content: titleMatch[2].trim(),
      };
    } else if (current) {
      // Continuation lines (including bullet items)
      const sep = current.content ? "\n" : "";
      current.content += sep + line;
    } else {
      // First content before any title — skip or treat as generic
      tips.push({ title: "DICA", content: line });
    }
  }
  if (current) tips.push(current);
  return tips;
}

/**
 * Seção 6: VOCABULÁRIO ESSENCIAL.
 * Formato: - Palavra: Tradução (Explicação opcional).
 */
function parseSectionVocabulary(lines) {
  const start = findSection(lines, "6. VOCABULÁRIO ESSENCIAL");
  const end = findSection(lines, "7. FLASHCARDS");
  const section = sectionLines(lines, start, end);

  const vocab = [];
  for (const line of section) {
    if (!line.startsWith("- ")) continue;
    const parts = line.substring(2).split(":");
    if (parts.length < 2) continue;

    const word = parts[0].trim();
    let rest = parts.slice(1).join(":").trim().replace(/\.\s*$/, "");
    let translation = rest;
    let explanation = null;

    const expMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*\.?\s*$/);
    if (expMatch) {
      translation = expMatch[1].trim();
      explanation = expMatch[2].trim();
    }
    translation = translation.replace(/\.\s*$/, "");

    vocab.push({ word, translation, explanation });
  }
  return vocab;
}

// ─── Main doc parser ──────────────────────────────────────────────────────────

function parseDoc(raw, fallback) {
  const lines = normaliseLines(raw);

  // --- Header ---
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

  // --- Sections ---
  const sentences = parseSectionSentences(lines);
  const full_text_pt = parseSectionPtText(lines);
  const phrases = parseSectionPhrases(lines);
  const tips = parseSectionTips(lines);
  const vocabItems = parseSectionVocabulary(lines);

  // --- Duration estimate ---
  const wordCount = sentences.reduce(
    (acc, s) => acc + s.en.split(/\s+/).filter(Boolean).length,
    0,
  );
  const minutes = wordCount / 140;
  const totalSeconds = Math.max(30, Math.round(minutes * 60));
  const mm = Math.floor(totalSeconds / 60);
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  const duration = `${mm}:${ss}`;

  return { theme, title, title_pt, full_text_pt, sentences, phrases, tips, vocabItems, duration };
}

// ─── Supabase import ──────────────────────────────────────────────────────────

async function importFile(filePath) {
  const { level, seq, slug } = parseFileName(filePath);
  console.log(`\n=== Importando arquivo ${path.basename(filePath)} ===`);

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseDoc(raw, { theme: slug, title: slug, title_pt: slug });

  console.log(
    `Título: ${parsed.title} (${parsed.title_pt}) – nível ${level}, seq ${seq}`,
  );
  console.log(
    `Frases: ${parsed.sentences.length} | Expressões: ${parsed.phrases.length} | Dicas: ${parsed.tips.length} | Vocab: ${parsed.vocabItems.length}`,
  );

  const title = parsed.title || slug;
  const title_pt = parsed.title_pt || title;
  const theme = parsed.theme || slug;

  // ── Upsert audio_text ──────────────
  const { data: existing } = await supabase
    .from("audio_texts")
    .select("id")
    .eq("level", level)
    .eq("seq", seq)
    .maybeSingle();

  let textId = existing?.id;

  if (textId) {
    const { error } = await supabase
      .from("audio_texts")
      .update({ title, title_pt, theme, duration: parsed.duration, full_text_pt: parsed.full_text_pt })
      .eq("id", textId);
    if (error) { console.error("Erro ao atualizar audio_text:", error); return; }
  } else {
    const { data: inserted, error } = await supabase
      .from("audio_texts")
      .insert({ title, title_pt, level, theme, seq, duration: parsed.duration, full_text_pt: parsed.full_text_pt })
      .select("id")
      .single();
    if (error || !inserted?.id) { console.error("Erro ao inserir audio_text:", error); return; }
    textId = inserted.id;
  }

  // ── Delete related data for clean re-import ────────────────────────────────
  await supabase.from("audio_text_sentences").delete().eq("text_id", textId);
  await supabase.from("audio_text_phrases").delete().eq("text_id", textId);
  await supabase.from("audio_text_tips").delete().eq("text_id", textId);

  // ── Insert sentences ──────────────
  const sentencePayload = parsed.sentences.map((s, idx) => ({
    text_id: textId,
    seq: idx + 1,
    en: s.en,
    pt: s.pt || s.en,
  }));

  const { data: insertedSentences, error: sentErr } = await supabase
    .from("audio_text_sentences")
    .insert(sentencePayload)
    .select("id, en");

  if (sentErr || !insertedSentences) {
    console.error("Erro ao inserir frases:", sentErr);
    return;
  }

  // ── Insert vocabulary ──────────────
  if (parsed.vocabItems.length > 0) {
    const vocabPayload = parsed.vocabItems.map((v) => {
      const targetSentence =
        insertedSentences.find((s) =>
          s.en.toLowerCase().includes(v.word.toLowerCase()),
        ) || insertedSentences[0];
      return {
        sentence_id: targetSentence.id,
        word: v.word,
        translation: v.translation,
        explanation: v.explanation,
      };
    });

    // Delete existing vocab for these sentences
    await supabase.from("audio_text_vocabulary").delete().in("sentence_id", insertedSentences.map(s => s.id));

    const { error: vocabErr } = await supabase.from("audio_text_vocabulary").insert(vocabPayload);
    if (vocabErr) {
      console.error("Erro ao inserir vocabulário:", vocabErr);
    } else {
      console.log(`+ ${vocabPayload.length} itens de vocabulário.`);
    }
  }

  // ── Insert bilingual phrases (Análise Bilíngue) ──────────────
  if (parsed.phrases.length > 0) {
    const phrasesPayload = parsed.phrases.map((p) => ({
      text_id: textId,
      phrase: p.phrase,
      translation: p.translation,
      explanation: p.explanation,
    }));

    const { error: phraseErr } = await supabase.from("audio_text_phrases").insert(phrasesPayload);
    if (phraseErr) {
      console.error("Erro ao inserir expressões:", phraseErr);
    } else {
      console.log(`+ ${phrasesPayload.length} expressões bilíngues.`);
    }
  }

  // ── Insert grammar tips (Toolkit Gramatical) ──────────────
  if (parsed.tips.length > 0) {
    const tipsPayload = parsed.tips.map((t, idx) => ({
      text_id: textId,
      seq: idx + 1,
      title: t.title,
      content: t.content,
    }));

    const { error: tipErr } = await supabase.from("audio_text_tips").insert(tipsPayload);
    if (tipErr) {
      console.error("Erro ao inserir dicas:", tipErr);
    } else {
      console.log(`+ ${tipsPayload.length} dicas gramaticais.`);
    }
  }

  console.log(`✅ Import concluído para "${parsed.title}"`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const files = listTextFiles();
  if (files.length === 0) {
    console.log(
      `Nenhum .txt encontrado em ${TEXTS_ROOT}. Coloque os arquivos nos níveis (ex: texts/a1, texts/a2) e rode de novo.`,
    );
    return;
  }

  for (const file of files) {
    try {
      await importFile(file);
    } catch (e) {
      console.error(
        `Falha ao processar ${path.basename(file)}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
