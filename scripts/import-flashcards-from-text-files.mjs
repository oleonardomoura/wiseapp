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

function normaliseLines(raw) {
  return raw.split(/\r?\n/).map((l) => l.trim());
}

function extractFlashcards(lines) {
  const idx = lines.findIndex((l) => l.toUpperCase().startsWith("7. FLASHCARDS"));
  if (idx === -1) return [];

  const after = lines.slice(idx + 1);
  const endIdx = after.findIndex((l) => /^\d+\.\s/.test(l));
  const section = endIdx === -1 ? after : after.slice(0, endIdx);

  const cards = [];
  let currentFront = null;
  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    const frontMatch = line.match(/^FRENTE:\s*(.*)$/i);
    if (frontMatch) {
      const front = frontMatch[1]?.trim();
      if (front) currentFront = front;
      continue;
    }

    const backMatch = line.match(/^VERSO:\s*(.*)$/i);
    if (backMatch) {
      const back = backMatch[1]?.trim();
      if (currentFront && back) {
        cards.push({ front: currentFront, back });
      }
      currentFront = null;
      continue;
    }
  }

  return cards;
}

async function ensureCollection(level) {
  const name = `Textos com Áudio - ${level}`;

  const { data: existing, error } = await supabase
    .from("flashcard_collections")
    .select("id, name, level")
    .eq("name", name)
    .eq("level", level)
    .maybeSingle();

  if (error) throw error;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from("flashcard_collections")
    .insert({ name, level })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return inserted.id;
}

async function clearCollectionFlashcards(collectionId) {
  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("collection_id", collectionId);
  if (error) throw error;
}

async function insertFlashcards(collectionId, cards) {
  const chunkSize = 200;
  for (let i = 0; i < cards.length; i += chunkSize) {
    const chunk = cards.slice(i, i + chunkSize).map((c) => ({
      collection_id: collectionId,
      front: c.front,
      back: c.back,
    }));
    const { error } = await supabase.from("flashcards").insert(chunk);
    if (error) throw error;
  }
}

async function main() {
  const files = walkTxtFiles(TEXTS_ROOT);
  if (files.length === 0) {
    throw new Error(`Nenhum .txt encontrado em ${TEXTS_ROOT}`);
  }

  const byLevel = new Map();

  for (const file of files) {
    const { level } = parseFileName(file);
    if (!level) continue;

    const raw = fs.readFileSync(file, "utf8");
    const lines = normaliseLines(raw);
    const cards = extractFlashcards(lines);
    if (cards.length === 0) continue;

    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(...cards);
  }

  if (byLevel.size === 0) {
    console.log("Nenhum flashcard encontrado nos arquivos.");
    return;
  }

  for (const [level, cardsRaw] of byLevel.entries()) {
    const uniq = new Map();
    for (const c of cardsRaw) {
      const k = `${c.front}||${c.back}`;
      if (!uniq.has(k)) uniq.set(k, c);
    }
    const cards = [...uniq.values()];

    const collectionId = await ensureCollection(level);
    await clearCollectionFlashcards(collectionId);
    await insertFlashcards(collectionId, cards);

    console.log(
      `Coleção "${`Textos com Áudio - ${level}`}" atualizada: ${cards.length} flashcards`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

