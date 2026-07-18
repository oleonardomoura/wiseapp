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

function normaliseLines(raw) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, idx, arr) => !(l === "" && idx > 0 && arr[idx - 1] === ""));
}

function parseDoc(raw, fallback) {
  const lines = normaliseLines(raw);

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

  return { theme, title, title_pt };
}

function parseFileName(filePath) {
  const base = path.basename(filePath, ".txt");
  const match = base.match(/^([A-Za-z]\d)_?(\d+)_?(.*)$/);
  if (!match) return { level: "", seq: 0, slug: base };
  const [, levelRaw, seqRaw, rest] = match;
  const level = levelRaw.toUpperCase();
  const seq = parseInt(seqRaw, 10) || 0;
  const slug = rest.replace(/_/g, " ").trim();
  return { level, seq, slug };
}

function walkTxtFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTxtFiles(p));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) out.push(p);
  }
  return out;
}

function keyFor(level, seq, title, title_pt) {
  return `${level}||${String(seq)}||${title}||${title_pt}`;
}

async function fetchAllAudioTexts() {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  // Paginate to avoid limits
  while (true) {
    const { data, error } = await supabase
      .from("audio_texts")
      .select("id, level, seq, title, title_pt, created_at")
      .range(from, from + pageSize - 1)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function deleteByIds(ids) {
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from("audio_texts").delete().in("id", chunk);
    if (error) throw error;
  }
}

async function main() {
  const files = walkTxtFiles(TEXTS_ROOT);
  if (files.length === 0) {
    throw new Error(`Nenhum arquivo .txt encontrado em ${TEXTS_ROOT}`);
  }

  const expectedKeys = new Set();

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const metaFromName = parseFileName(filePath);
    const parsed = parseDoc(raw, { theme: metaFromName.slug, title: metaFromName.slug, title_pt: metaFromName.slug });
    const level = metaFromName.level || "";
    const seq = metaFromName.seq || 0;
    if (!level || !seq) continue;
    expectedKeys.add(keyFor(level, seq, parsed.title || metaFromName.slug, parsed.title_pt || metaFromName.slug));
  }

  const rows = await fetchAllAudioTexts();
  const toDelete = [];

  // First: delete everything not in expected
  for (const r of rows) {
    const k = keyFor(r.level, r.seq, r.title, r.title_pt);
    if (!expectedKeys.has(k)) toDelete.push(r);
  }

  // Second: dedupe expected (keep newest created_at, delete older duplicates)
  const expectedRows = rows.filter((r) => expectedKeys.has(keyFor(r.level, r.seq, r.title, r.title_pt)));
  const groups = new Map();
  for (const r of expectedRows) {
    const k = keyFor(r.level, r.seq, r.title, r.title_pt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const [k, group] of groups.entries()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // newest first
    for (const extra of group.slice(1)) {
      toDelete.push(extra);
    }
  }

  const ids = [...new Set(toDelete.map((r) => r.id))];
  console.log(`Arquivos .txt encontrados: ${files.length}`);
  console.log(`Registros audio_texts encontrados: ${rows.length}`);
  console.log(`Registros a remover (fora da pasta / duplicados): ${ids.length}`);

  if (ids.length === 0) {
    console.log("Nada para remover.");
    return;
  }

  await deleteByIds(ids);
  console.log("Remoção concluída.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

