'use strict';

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase();
}

function fuzzyScore(query, target) {
  if (!query) return 0;
  const q = query;
  const t = target;
  let qi = 0;
  let score = 0;
  let prev = -1;
  let run = 0;

  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 5;
      if (prev === i - 1) {
        run += 1;
        score += run * 3;
      } else {
        run = 0;
      }
      if (i === 0 || /[\\/._\-\s]/.test(t[i - 1])) score += 12;
      if (t[i] === q[qi] && i > 0 && /[A-Z]/.test(target[i])) score += 2;
      prev = i;
      qi += 1;
    }
  }

  if (qi < q.length) return -1;

  const start = t.indexOf(q);
  if (start >= 0) score += 40 - Math.min(start, 30);

  score += Math.max(0, 30 - Math.floor(t.length / 8));
  return score;
}

function tokenScore(query, entry) {
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;

  let total = 0;
  for (const token of tokens) {
    const nameScore = fuzzyScore(token, entry.lname);
    const pathScore = fuzzyScore(token, entry.lpath) * 0.65;
    const best = Math.max(nameScore, pathScore);
    if (best < 0) return -1;
    total += best;
  }
  return total + (entry.isDir ? 2 : 0);
}

function searchIndex(index, query, limit = 80) {
  const q = normalizeQuery(query);
  if (!q) return [];

  const results = [];
  for (const entry of index) {
    const score = tokenScore(q, entry);
    if (score >= 0) results.push({ entry, score });
  }

  results.sort((a, b) => b.score - a.score || a.entry.lname.localeCompare(b.entry.lname));
  return results.slice(0, limit).map((r) => ({
    path: r.entry.path,
    name: r.entry.name,
    isDir: r.entry.isDir,
    score: r.score,
  }));
}

module.exports = { searchIndex, fuzzyScore };
