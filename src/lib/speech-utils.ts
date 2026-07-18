// ── Text comparison utilities for oral practice ──

const contractions: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'd": "i would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "won't": "will not",
  "can't": "cannot",
  "couldn't": "could not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "what's": "what is",
  "that's": "that is",
  "there's": "there is",
  "here's": "here is",
  "let's": "let us",
};

function normalize(text: string): string {
  let t = text.toLowerCase().trim();
  // Remove punctuation
  t = t.replace(/[.,!?;:'"()-]/g, "");
  // Expand contractions
  for (const [contraction, expansion] of Object.entries(contractions)) {
    t = t.replace(new RegExp(`\\b${contraction.replace("'", "'")}\\b`, "gi"), expansion);
    t = t.replace(new RegExp(`\\b${contraction}\\b`, "gi"), expansion);
  }
  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Calculate word-level similarity between two texts (0-100)
 */
export function calculateSimilarity(spoken: string, target: string): number {
  const spokenNorm = normalize(spoken);
  const targetNorm = normalize(target);

  if (spokenNorm === targetNorm) return 100;

  const spokenWords = spokenNorm.split(" ");
  const targetWords = targetNorm.split(" ");

  if (targetWords.length === 0) return 0;

  let matches = 0;
  const usedIndices = new Set<number>();

  for (const sw of spokenWords) {
    for (let j = 0; j < targetWords.length; j++) {
      if (!usedIndices.has(j) && sw === targetWords[j]) {
        matches++;
        usedIndices.add(j);
        break;
      }
    }
  }

  // Also penalize extra words
  const precision = spokenWords.length > 0 ? matches / spokenWords.length : 0;
  const recall = matches / targetWords.length;

  if (precision + recall === 0) return 0;
  const f1 = (2 * precision * recall) / (precision + recall);
  return Math.round(f1 * 100);
}

export function getFeedbackMessage(score: number): { text: string; emoji: string; variant: 'success' | 'warning' | 'error' } {
  if (score >= 90) return { text: "Excelente! Pronúncia perfeita!", emoji: "🎉", variant: "success" };
  if (score >= 70) return { text: "Muito bom! Continue assim!", emoji: "👏", variant: "success" };
  if (score >= 50) return { text: "Quase lá! Tente de novo.", emoji: "💪", variant: "warning" };
  return { text: "Tente novamente com mais calma.", emoji: "🔄", variant: "error" };
}

/**
 * Check consolidation answer against correct + acceptable answers
 */
export function checkConsolidationAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptable: string[]
): boolean {
  const userNorm = normalize(userAnswer);
  const correctNorm = normalize(correctAnswer);

  if (userNorm === correctNorm) return true;

  for (const alt of acceptable) {
    if (userNorm === normalize(alt)) return true;
  }

  return false;
}
