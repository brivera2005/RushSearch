'use strict';

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase();
}

function quickSubsequence(token, target) {
  let qi = 0;
  for (let i = 0; i < target.length && qi < token.length; i += 1) {
    if (target[i] === token[qi]) qi += 1;
  }
  return qi === token.length;
}

function fuzzyScore(query, target) {
  if (!query) return 0;
  const q = query;
  const t = target;
  let qi = 0;
  let score = 0;
  let prev = -1;
  let run = 0;

  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      score += 5;
      if (prev === i - 1) {
        run += 1;
        score += run * 3;
      } else {
        run = 0;
      }
      if (i === 0 || /[\\/._\-\s]/.test(t[i - 1])) score += 12;
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

function baseName(lname) {
  const dot = lname.lastIndexOf('.');
  return dot > 0 ? lname.slice(0, dot) : lname;
}

const LOW_PRIO_EXT = new Set([
  '.dll', '.log', '.tmp', '.cache', '.json', '.xml', '.pak', '.sig',
  '.md', '.txt', '.ini', '.cfg', '.dat', '.bin', '.manifest', '.pdb',
]);

const NOISE_EXE = /uninstall|setup|installer|update|crash|redist|helper|support|diag/i;

function isExeEntry(entry) {
  return entry.isExe || (!entry.isDir && entry.lname.endsWith('.exe'));
}

function launchBoost(query, entry) {
  let boost = 0;
  const tokens = query.split(/\s+/).filter(Boolean);
  const stem = baseName(entry.lname);

  if (isExeEntry(entry)) {
    boost += 150;
    for (const token of tokens) {
      if (stem === token) boost += 250;
      else if (stem.startsWith(token)) boost += 100;
      else if (stem.includes(token)) boost += 50;
    }
    if (NOISE_EXE.test(entry.lname)) boost -= 80;
    const depth = (entry.path.match(/\\/g) || []).length;
    boost += Math.max(0, 30 - depth);
    if (/steamapps|epic games|program files|games|riot games|battle\.net|ubisoft/i.test(entry.lpath)) {
      boost += 40;
    }
  } else if (entry.isDir) {
    boost -= 20;
    for (const token of tokens) {
      if (entry.lname === token || entry.lname.startsWith(token)) boost += 15;
    }
  } else {
    boost -= 25;
    const dot = entry.lname.lastIndexOf('.');
    const ext = dot >= 0 ? entry.lname.slice(dot) : '';
    if (LOW_PRIO_EXT.has(ext)) boost -= 50;
  }

  return boost;
}

function tokenScore(query, entry) {
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return -1;

  let total = 0;
  for (const token of tokens) {
    if (
      !quickSubsequence(token, entry.lname) &&
      !quickSubsequence(token, entry.lpath)
    ) {
      return -1;
    }
    const nameScore = fuzzyScore(token, entry.lname);
    const pathScore = fuzzyScore(token, entry.lpath) * 0.65;
    const best = Math.max(nameScore, pathScore);
    if (best < 0) return -1;
    total += best;
  }

  return total + launchBoost(query, entry);
}

function candidateIndices(entries, query, helper) {
  if (!helper || !helper.buckets) return null;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  const set = new Set();
  for (const token of tokens) {
    const c = token[0];
    const b = helper.buckets.get(c);
    if (b) b.forEach((i) => set.add(i));
    if (helper.exeBuckets) {
      const eb = helper.exeBuckets.get(c);
      if (eb) eb.forEach((i) => set.add(i));
    }
  }
  if (set.size > 0 && set.size < entries.length) return [...set];
  return null;
}

function searchIndex(index, query, limit = 80, helper = null) {
  const q = normalizeQuery(query);
  if (!q) return [];

  const indices = candidateIndices(index, q, helper);
  const scan = indices || index.map((_, i) => i);

  const results = [];
  for (const i of scan) {
    const entry = index[i];
    const score = tokenScore(q, entry);
    if (score >= 0) results.push({ entry, score });
  }

  if (results.length > limit * 4) {
    results.sort((a, b) => b.score - a.score);
    results.length = limit * 4;
  }

  results.sort((a, b) => b.score - a.score || a.entry.lname.localeCompare(b.entry.lname));
  return results.slice(0, limit).map((r) => ({
    path: r.entry.path,
    name: r.entry.name,
    isDir: r.entry.isDir,
    isExe: isExeEntry(r.entry),
    score: r.score,
  }));
}

module.exports = { searchIndex, fuzzyScore };
