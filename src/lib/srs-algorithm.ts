// SM-2 Spaced Repetition Algorithm (Adatado para estilo Anki)

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SRSState {
  easinessFactor: number;
  interval: number; // dias
  repetitions: number;
  dueAt: string; // ISO timestamp
}

/**
 * Calcula os intervalos (em dias) esperados para cada botão de resposta
 * assumindo a lógica Anki
 */
export function calculateNextIntervals(state: SRSState): Record<Rating, number> {
  const { easinessFactor, interval, repetitions } = state;
  const isNew = interval === 0 && repetitions === 0;

  if (isNew) {
    return {
      again: 0,
      hard: 1,
      good: 3,
      easy: 5,
    };
  }

  return {
    again: 0, // Zera para revisão hoje (ou fallback para 1 dependendo da preferência)
    hard: Math.max(1, Math.round(interval * 1.2)),
    good: Math.max(1, Math.round(interval * easinessFactor)),
    easy: Math.max(1, Math.round(interval * easinessFactor * 1.3)),
  };
}

/**
 * Processa a revisão e retorna o estado SRS atualizado
 */
export function processReview(state: SRSState, rating: Rating): SRSState {
  let { easinessFactor, repetitions } = state;
  const nextIntervals = calculateNextIntervals(state);
  const interval = nextIntervals[rating];

  if (rating === 'again') {
    // Falha: reseta a contagem de acertos seguidos
    repetitions = 0;
  } else {
    // Acerto
    repetitions += 1;
  }

  // Atualiza o Easiness Factor baseado na mecânica do Anki
  let delta = 0;
  if (rating === 'again') delta = -0.20;
  else if (rating === 'hard') delta = -0.15;
  else if (rating === 'good') delta = 0;
  else if (rating === 'easy') delta = 0.15;

  easinessFactor = Math.max(1.3, easinessFactor + delta);

  // Calcula o próximo vencimento
  const now = new Date();
  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    easinessFactor: Math.round(easinessFactor * 100) / 100,
    interval,
    repetitions,
    dueAt: dueDate.toISOString(),
  };
}

/**
 * Check if a card is due for review
 */
export function isDue(dueAt: string): boolean {
  return new Date(dueAt) <= new Date();
}

/**
 * Get display info for next review interval
 */
export function getIntervalDisplay(interval: number): string {
  if (interval === 0) return '< 15m';
  if (interval === 1) return '1 dia';
  if (interval < 30) return `${interval} dias`;
  if (interval < 365) return `${Math.round(interval / 30)} meses`;
  return `${Math.round(interval / 365)} anos`;
}
