/** Small subsequence fuzzy scorer. Returns -1 when `query` doesn't match. */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let ti = 0;
  let score = 0;
  let prev = -2;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return -1;
    score += 1;
    if (idx === prev + 1) score += 3;
    if (idx === 0 || t[idx - 1] === " ") score += 2;
    score -= (idx - ti) * 0.15;
    prev = idx;
    ti = idx + 1;
  }
  return score;
}
