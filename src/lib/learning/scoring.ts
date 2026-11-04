export interface ScorableQuestion {
  id: string;
  correctOptionIds: string[];
}

export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
}

export interface AttemptScore {
  correctCount: number;
  totalCount: number;
  /** Whole percent, rounded DOWN so a displayed score never overstates a pass. */
  score: number;
  results: QuestionResult[];
}

/**
 * Exact-set match: a question is correct only if the learner selected every
 * correct option and nothing else (so single, multiple and true/false all use
 * the same rule). Selecting nothing is always wrong.
 */
export function gradeQuestion(correctOptionIds: string[], selectedOptionIds: string[]): boolean {
  const correct = new Set(correctOptionIds);
  const selected = new Set(selectedOptionIds);
  if (correct.size === 0 || selected.size === 0) return false;
  if (correct.size !== selected.size) return false;
  for (const id of selected) if (!correct.has(id)) return false;
  return true;
}

export function scoreAttempt(
  questions: ScorableQuestion[],
  answers: Record<string, string[]>,
): AttemptScore {
  const results = questions.map((q) => ({
    questionId: q.id,
    isCorrect: gradeQuestion(q.correctOptionIds, answers[q.id] ?? []),
  }));
  const correctCount = results.filter((r) => r.isCorrect).length;
  const totalCount = questions.length;
  const score = totalCount === 0 ? 0 : Math.floor((correctCount * 100) / totalCount);
  return { correctCount, totalCount, score, results };
}

/**
 * Integer comparison (no float rounding) so 7/10 against a 70% bar is a pass
 * and 69.9% never rounds up into one. An empty quiz can never be passed.
 */
export function hasPassed(correctCount: number, totalCount: number, passScore: number): boolean {
  if (totalCount === 0) return false;
  return correctCount * 100 >= passScore * totalCount;
}
