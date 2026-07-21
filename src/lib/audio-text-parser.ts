// Parses the structured text format used for "Textos com Áudio" (same format
// as scripts/import-audio-texts-from-files.mjs), so admins/teachers can paste
// a ready-made story and have every section auto-filled instead of typing
// sentence-by-sentence, tip-by-tip, phrase-by-phrase.
//
// Expected sections (in order), each on its own line:
//   Nível X - Unidade NN: <tema>
//   Título da Cena: <title> (<title_pt>)
//   1. TEXTO FLUÍDO - EN
//   2. TEXTO FLUÍDO - PT-BR
//   3. ESTUDO ATIVO (LINHA POR LINHA)
//   4. ANÁLISE BILÍNGUE (SENTENCE BY SENTENCE)
//   5. TOOLKIT GRAMATICAL (DICAS)
//   6. VOCABULÁRIO ESSENCIAL
//   7. FLASHCARDS (ANKI)

export interface ParsedSentence {
  en: string;
  pt: string;
}

export interface ParsedPhrase {
  phrase: string;
  translation: string;
  explanation: string | null;
}

export interface ParsedTip {
  title: string;
  content: string;
}

export interface ParsedVocabItem {
  word: string;
  translation: string;
  explanation: string | null;
}

export interface ParsedAudioText {
  level: string | null;
  theme: string;
  title: string;
  title_pt: string;
  full_text_pt: string;
  duration: string;
  sentences: ParsedSentence[];
  phrases: ParsedPhrase[];
  tips: ParsedTip[];
  vocabItems: ParsedVocabItem[];
}

function normaliseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter((l, idx, arr) => !(l === '' && idx > 0 && arr[idx - 1] === ''));
}

function findSection(lines: string[], prefix: string): number {
  return lines.findIndex(l => l.toUpperCase().startsWith(prefix.toUpperCase()));
}

function sectionLines(lines: string[], startIdx: number, endIdx: number): string[] {
  if (startIdx === -1) return [];
  const end = endIdx > startIdx ? endIdx : lines.length;
  return lines.slice(startIdx + 1, end);
}

function parseSectionPtText(lines: string[]): string {
  const start = findSection(lines, '2. TEXTO FLUÍDO - PT-BR');
  const end = findSection(lines, '3. ESTUDO ATIVO');
  return sectionLines(lines, start, end).filter(Boolean).join('\n');
}

function parseSectionSentences(lines: string[]): ParsedSentence[] {
  const start = findSection(lines, '3. ESTUDO ATIVO');
  const end = findSection(lines, '4.');
  const section = sectionLines(lines, start, end);

  const sentences: ParsedSentence[] = [];
  for (let i = 0; i < section.length; i++) {
    const enLine = section[i].trim();
    if (!enLine || enLine.startsWith('(')) continue;

    let ptLine = '';
    let j = i + 1;
    while (j < section.length) {
      const candidate = section[j].trim();
      if (candidate.startsWith('(')) {
        ptLine = candidate;
        break;
      }
      if (candidate !== '' && !candidate.startsWith('(')) break;
      j++;
    }

    const en = enLine.replace(/^[""]/, '').replace(/[""]$/, '').trim();
    const pt = ptLine.replace(/^\(/, '').replace(/\)\s*$/, '').trim();

    sentences.push({ en, pt });
    if (ptLine) i = j;
  }
  return sentences;
}

function parseSectionPhrases(lines: string[]): ParsedPhrase[] {
  const start = findSection(lines, '4. ANÁLISE BILÍNGUE');
  const end = findSection(lines, '5. TOOLKIT GRAMATICAL');
  const section = sectionLines(lines, start, end);

  const phrases: ParsedPhrase[] = [];
  for (const line of section) {
    if (!line.startsWith('- ')) continue;
    const parts = line.substring(2).split('|');
    if (parts.length < 2) continue;

    const phrase = parts[0].trim().replace(/\.\s*$/, '');
    const rest = parts.slice(1).join('|').trim();
    let translation = rest;
    let explanation: string | null = null;

    const expMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*\.?\s*$/);
    if (expMatch) {
      translation = expMatch[1].trim().replace(/\.\s*$/, '');
      explanation = expMatch[2].trim();
    }
    translation = translation.replace(/\.\s*$/, '');

    phrases.push({ phrase, translation, explanation });
  }
  return phrases;
}

function parseSectionTips(lines: string[]): ParsedTip[] {
  const start = findSection(lines, '5. TOOLKIT GRAMATICAL');
  const end = findSection(lines, '6. VOCABULÁRIO ESSENCIAL');
  const section = sectionLines(lines, start, end);

  const tips: ParsedTip[] = [];
  let current: ParsedTip | null = null;

  for (const line of section) {
    if (!line) continue;
    const titleMatch = line.match(/^([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]+):\s*(.*)/);
    if (titleMatch) {
      if (current) tips.push(current);
      current = { title: titleMatch[1].trim(), content: titleMatch[2].trim() };
    } else if (current) {
      const sep = current.content ? '\n' : '';
      current.content += sep + line;
    } else {
      tips.push({ title: 'DICA', content: line });
    }
  }
  if (current) tips.push(current);
  return tips;
}

function parseSectionVocabulary(lines: string[]): ParsedVocabItem[] {
  const start = findSection(lines, '6. VOCABULÁRIO ESSENCIAL');
  const end = findSection(lines, '7. FLASHCARDS');
  const section = sectionLines(lines, start, end);

  const vocab: ParsedVocabItem[] = [];
  for (const line of section) {
    if (!line.startsWith('- ')) continue;
    const parts = line.substring(2).split(':');
    if (parts.length < 2) continue;

    const word = parts[0].trim();
    const rest = parts.slice(1).join(':').trim().replace(/\.\s*$/, '');
    let translation = rest;
    let explanation: string | null = null;

    const expMatch = rest.match(/^(.*?)\s*\(([^)]+)\)\s*\.?\s*$/);
    if (expMatch) {
      translation = expMatch[1].trim();
      explanation = expMatch[2].trim();
    }
    translation = translation.replace(/\.\s*$/, '');

    vocab.push({ word, translation, explanation });
  }
  return vocab;
}

export function parseAudioTextDocument(raw: string): ParsedAudioText {
  const lines = normaliseLines(raw);

  const headerLine = lines.find(l => l.startsWith('Nível ')) ?? '';
  let theme = '';
  if (headerLine.includes(':')) {
    const afterColon = headerLine.split(':')[1]?.trim();
    if (afterColon) theme = afterColon;
  }
  const levelMatch = headerLine.match(/^Nível\s+([A-C][12])/i);
  const level = levelMatch ? levelMatch[1].toUpperCase() : null;

  const titleLine = lines.find(l => l.startsWith('Título da Cena:')) ?? '';
  let title = '';
  let title_pt = '';
  const m = titleLine.match(/^Título da Cena:\s*(.+?)\s*\((.+)\)/);
  if (m) {
    title = m[1].trim();
    title_pt = m[2].trim();
  }

  const sentences = parseSectionSentences(lines);
  const full_text_pt = parseSectionPtText(lines);
  const phrases = parseSectionPhrases(lines);
  const tips = parseSectionTips(lines);
  const vocabItems = parseSectionVocabulary(lines);

  const wordCount = sentences.reduce((acc, s) => acc + s.en.split(/\s+/).filter(Boolean).length, 0);
  const minutes = wordCount / 140;
  const totalSeconds = Math.max(30, Math.round(minutes * 60));
  const mm = Math.floor(totalSeconds / 60);
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  const duration = `${mm}:${ss}`;

  return { level, theme, title, title_pt, full_text_pt, duration, sentences, phrases, tips, vocabItems };
}

/** Matches each vocabulary word to the first sentence that contains it (case-insensitive), like the import script does. */
export function matchVocabToSentences<T extends { id: string; en: string }>(
  vocabItems: ParsedVocabItem[],
  sentences: T[],
): { sentence_id: string; word: string; translation: string; explanation: string | null }[] {
  if (sentences.length === 0) return [];
  return vocabItems.map(v => {
    const target = sentences.find(s => s.en.toLowerCase().includes(v.word.toLowerCase())) ?? sentences[0];
    return { sentence_id: target.id, word: v.word, translation: v.translation, explanation: v.explanation };
  });
}
