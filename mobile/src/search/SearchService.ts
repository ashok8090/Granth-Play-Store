import type { Granth, Praman, Topic } from "../models/types";

const MATRAS = /[\u093e\u093f\u0940\u0941\u0942\u0943\u0944\u0947\u0948\u094b\u094c\u0902\u0901\u094d\u093c\u200c\u200d]/g;
const STOP = new Set([
  "की", "के", "का", "में", "से", "को", "और", "या", "है", "पर", "यह", "वह", "एक", "भी", "हो", "ने", "कि",
  "the", "of", "and", "in", "to", "a",
]);

const CLUSTERS: string[][] = [
  ["मांस", "mans", "maans", "maas", "meat"],
  ["मृत्यु", "मरण", "मौत", "mrityu", "mrutyu", "maran", "death"],
  ["ब्रह्मा", "ब्रह्म", "brahma", "brahm", "bramha", "brahmaa"],
  ["कृष्ण", "krishna", "krishan", "kishan"],
  ["कबीर", "kabir", "kabeer"],
  ["गीता", "gita", "geeta"],
  ["मोक्ष", "मुक्ति", "moksh", "moksha"],
  ["तीर्थ", "teerth", "tirth"],
  ["राम", "raam", "ram"],
  ["शिव", "shiv", "shiva"],
  ["वेद", "ved", "veda"],
];

const CONS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
  क्ष: "ksh", त्र: "tr", ज्ञ: "gy",
};

const VOWEL_SIGN: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "e", "ो": "o", "ौ": "o",
  "ं": "n", "ँ": "n", "्": "", "़": "",
};

const INDEP: Record<string, string> = {
  अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ए: "e", ऐ: "e", ओ: "o", औ: "o", ऋ: "ri",
};

function foldLatin(value: string): string {
  return value
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/ai/g, "e")
    .replace(/au/g, "o");
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripMatras(value: string): string {
  return normalizeText(value).replace(MATRAS, "");
}

export function romanize(value: string): string {
  const text = normalizeText(value);
  let out = "";
  const chars = [...text];
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] ?? "";
    const next = chars[i + 1] ?? "";
    const pair = ch + next;
    if (CONS[pair]) {
      out += CONS[pair];
      i += 1;
      if ((chars[i + 1] ?? "") === "्") {
        i += 1;
        continue;
      }
      const sign = chars[i + 1] ?? "";
      if (VOWEL_SIGN[sign] !== undefined) {
        out += VOWEL_SIGN[sign];
        i += 1;
      } else if (ch !== " " && !INDEP[ch]) {
        out += "a";
      }
      continue;
    }
    if (CONS[ch]) {
      out += CONS[ch];
      if (next === "्") {
        i += 1;
        continue;
      }
      if (VOWEL_SIGN[next] !== undefined) {
        out += VOWEL_SIGN[next];
        i += 1;
      } else {
        out += "a";
      }
      continue;
    }
    if (VOWEL_SIGN[ch] !== undefined) {
      out += VOWEL_SIGN[ch];
      continue;
    }
    if (INDEP[ch]) {
      out += INDEP[ch];
      continue;
    }
    if (ch === " ") out += " ";
    else if (/[a-z0-9]/.test(ch)) out += ch;
  }
  return foldLatin(out.replace(/\s+/g, " ").trim());
}

export function transliterateQuery(query: string): string[] {
  const base = normalizeText(query);
  const forms = new Set<string>([base, romanize(base), stripMatras(base)]);
  for (const cluster of CLUSTERS) {
    const hit = cluster.some((term) => {
      const n = normalizeText(term);
      return base.includes(n) || n.includes(base) || romanize(term) === romanize(base);
    });
    if (hit) {
      for (const term of cluster) {
        forms.add(normalizeText(term));
        forms.add(romanize(term));
      }
    }
  }
  return [...forms].filter((item) => item.length > 0);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length] ?? 0;
}

export function fuzzyMatch(query: string, text: string): number {
  const q = romanize(query);
  const t = romanize(text);
  if (!q || !t) return 0;
  if (t.includes(q) || stripMatras(text).includes(stripMatras(query))) return 1;
  const limit = q.length <= 4 ? 1 : 2;
  if (q.length <= 24 && t.length <= 48 && levenshtein(q, t) <= limit) return 0.8;
  const tokens = t.split(" ");
  return tokens.some((token) => (token.length <= 24 && levenshtein(q, token) <= limit) || token.startsWith(q)) ? 0.7 : 0;
}

type Need = { forms: string[] };

function clusterFor(token: string): string[] | undefined {
  const norm = normalizeText(token);
  const roman = romanize(token);
  return CLUSTERS.find((cluster) =>
    cluster.some((term) => {
      const n = normalizeText(term);
      return n === norm || romanize(term) === roman || (norm.length >= 3 && (n.includes(norm) || roman.includes(romanize(term))));
    }),
  );
}

function queryNeeds(query: string): Need[] {
  const tokens = normalizeText(query)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP.has(token));
  const needs: Need[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const cluster = clusterFor(token);
    const forms = cluster
      ? cluster.flatMap((term) => [normalizeText(term), romanize(term), stripMatras(term)])
      : [normalizeText(token), romanize(token), stripMatras(token)];
    const key = forms[0] ?? token;
    if (seen.has(key)) continue;
    seen.add(key);
    needs.push({ forms: [...new Set(forms.filter((form) => form.length > 1))] });
  }
  return needs;
}

function blobHas(form: string, norm: string, roman: string, bare: string): boolean {
  if (!form) return false;
  return norm.includes(form) || roman.includes(romanize(form)) || bare.includes(stripMatras(form));
}

export function calculateRelevance(query: string, fields: string[]): number {
  const raw = query.trim();
  if (!raw) return 1;
  const blob = fields.filter(Boolean).join("\n");
  const norm = normalizeText(blob);
  const roman = romanize(blob);
  const bare = stripMatras(blob);
  let best = 0;
  const exact = normalizeText(raw);
  if (exact && norm.includes(exact)) best = 100;
  else if (roman.includes(romanize(raw))) best = Math.max(best, 84);
  for (const form of transliterateQuery(raw)) {
    if (blobHas(form, norm, roman, bare)) best = Math.max(best, form === exact ? 100 : 76);
    const fuzzy = fuzzyMatch(form, blob);
    if (fuzzy) best = Math.max(best, Math.round(fuzzy * 62));
  }
  const needs = queryNeeds(raw);
  if (needs.length >= 2) {
    let matched = 0;
    for (const need of needs) {
      if (need.forms.some((form) => blobHas(form, norm, roman, bare) || fuzzyMatch(form, blob) >= 0.7)) matched += 1;
    }
    if (matched > 0) {
      const ratio = matched / needs.length;
      best = Math.max(best, Math.round(36 + ratio * 58));
    }
  }
  return best;
}

export function rankBySearch<T>(rows: T[], query: string, fields: (row: T) => string[]): T[] {
  const q = query.trim();
  if (!q) return rows;
  return rows
    .map((row) => ({ row, score: calculateRelevance(q, fields(row)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
}

export function searchTopics(rows: Topic[], query: string): Topic[] {
  return rankBySearch(rows, query, (row) => [row.title, row.description]);
}

export function searchGranth(rows: Granth[], query: string): Granth[] {
  return rankBySearch(rows, query, (row) => [row.title, row.author, row.description]);
}

export function searchPramaan(rows: Praman[], query: string): Praman[] {
  return rankBySearch(rows, query, (row) => [
    row.title,
    row.description,
    row.topic_title,
    row.granth_title,
    row.granth_auther,
  ]);
}
