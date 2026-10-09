const MATRAS = /[\u093e\u093f\u0940\u0941\u0942\u0943\u0944\u0947\u0948\u094b\u094c\u0902\u0901\u094d\u093c\u200c\u200d]/g;

const CLUSTERS: string[][] = [
  ["मांस", "माँस", "mans", "maans", "maas", "meat"],
  ["मृत्यु", "मरण", "मौत", "mrityu", "mrutyu", "maran", "maut", "death"],
  ["ब्रह्मा", "ब्रह्म", "brahma", "brahm", "bramha", "brahmaa"],
  ["कृष्ण", "krishna", "krishan", "kishan", "krishn"],
  ["कबीर", "kabir", "kabeer", "kavir"],
  ["गीता", "gita", "geeta", "geetaa", "githa"],
  ["भगवद्गीता", "भगवदगीता", "भगवद्", "भगवद", "bhagavad", "bhagvad", "bhagwat", "bhagwad", "bhagvat"],
  ["भगवान", "bhagwan", "bhagavan", "bhagwaan"],
  ["गुरु", "गुरू", "सद्गुरु", "सतगुरु", "गुरुदेव", "guru", "guruji", "gurudev", "sadguru", "satguru"],
  ["मोक्ष", "मुक्ति", "moksh", "moksha", "mukti"],
  ["तीर्थ", "teerth", "tirth", "tirtha"],
  ["राम", "raam", "ram", "rama"],
  ["रामायण", "ramayan", "ramayana"],
  ["महाभारत", "mahabharat", "mahabharata"],
  ["शिव", "shiv", "shiva"],
  ["वेद", "ved", "veda", "vedas"],
  ["हनुमान", "hanuman", "hanumaan"],
  ["विष्णु", "vishnu", "vishnoo"],
  ["गणेश", "ganesh", "ganesha"],
  ["दुर्गा", "durga"],
  ["कर्म", "karma", "karm"],
  ["धर्म", "dharma", "dharm"],
  ["आत्मा", "atma", "atman"],
  ["भक्ति", "bhakti"],
  ["ज्ञान", "gyan", "gyaan", "jnana"],
  ["संत", "सन्त", "sant", "saint"],
  ["साधु", "sadhu"],
  ["स्वर्ग", "swarg", "svarg", "heaven"],
  ["नरक", "nark", "narak", "hell"],
  ["पाप", "paap", "pap", "sin"],
  ["पुण्य", "punya"],
  ["उपनिषद", "upanishad"],
  ["पुराण", "puran", "purana"],
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
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

const STOP = new Set([
  "की", "के", "का", "कि", "में", "से", "को", "और", "या", "है", "पर", "यह", "वह", "एक", "भी", "हो", "ने",
  "the", "of", "and", "in", "to", "a",
]);

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

export function foldLatin(value: string): string {
  return value
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/ai/g, "e")
    .replace(/au/g, "o")
    .replace(/w/g, "v")
    .replace(/ph/g, "f")
    .replace(/q/g, "k");
}

export function romanize(value: string): string {
  const text = normalizeText(value);
  const chars = [...text];
  let out = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] ?? "";
    if (ch === " ") {
      out += " ";
      continue;
    }
    if (ch === "अ") { out += "a"; continue; }
    if (ch === "आ") { out += "a"; continue; }
    if (ch === "इ" || ch === "ई") { out += "i"; continue; }
    if (ch === "उ" || ch === "ऊ") { out += "u"; continue; }
    if (ch === "ए") { out += "e"; continue; }
    if (ch === "ऐ") { out += "ai"; continue; }
    if (ch === "ओ") { out += "o"; continue; }
    if (ch === "औ") { out += "au"; continue; }
    if (ch === "ऋ") { out += "ri"; continue; }
    if (ch === "ं" || ch === "ँ") { out += "n"; continue; }
    if (ch === "्" || ch === "़") continue;
    const pair = ch + (chars[i + 1] ?? "");
    const cons = CONS[pair] ? CONS[pair] : CONS[ch];
    if (!cons) {
      if (/[a-z0-9]/.test(ch)) out += ch;
      continue;
    }
    if (CONS[pair]) i += 1;
    out += cons;
    const sign = chars[i + 1] ?? "";
    if (sign === "्") {
      i += 1;
      continue;
    }
    if (VOWEL_SIGN[sign]) {
      out += VOWEL_SIGN[sign];
      i += 1;
      const nasal = chars[i + 1] ?? "";
      if (nasal === "ं" || nasal === "ँ") {
        out += "n";
        i += 1;
      }
      continue;
    }
    if (sign === "ं" || sign === "ँ") {
      out += "n";
      i += 1;
      continue;
    }
    const after = chars[i + 1] ?? "";
    if (after && after !== " ") out += "a";
  }
  return foldLatin(out.replace(/\s+/g, " ").trim());
}

function skeleton(roman: string): string {
  return roman.replace(/[aeiou\s]/g, "");
}

function expandToken(token: string): string[] {
  const base = normalizeText(token);
  const roman = foldLatin(romanize(base));
  const forms = new Set<string>([base, roman, stripMatras(base)]);
  for (const cluster of CLUSTERS) {
    const hit = cluster.some((term) => {
      const n = normalizeText(term);
      const r = foldLatin(romanize(term));
      return n === base || r === roman;
    });
    if (!hit) continue;
    for (const term of cluster) forms.add(normalizeText(term));
  }
  return [...forms].filter(Boolean);
}

export function transliterateQuery(query: string): string[] {
  const forms = new Set<string>();
  for (const token of normalizeText(query).split(" ")) {
    if (!token || STOP.has(token)) continue;
    for (const form of expandToken(token)) forms.add(form);
  }
  if (!forms.size && query.trim()) forms.add(normalizeText(query));
  return [...forms];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
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
  const q = foldLatin(romanize(query));
  const t = foldLatin(romanize(text));
  if (!q || !t) return 0;
  if (t.includes(q) || stripMatras(text).includes(stripMatras(query))) return 1;
  const limit = q.length <= 4 ? 1 : 2;
  if (levenshtein(q, t) <= limit) return 0.8;
  return t.split(" ").some((token) => token.startsWith(q) || (q.length >= 4 && levenshtein(q, token) <= 1)) ? 0.7 : 0;
}

type DocKeys = {
  norm: string;
  bare: string;
  roman: string;
  skel: string;
  tokens: string[];
};

function keysOf(text: string): DocKeys {
  const norm = normalizeText(text);
  const roman = romanize(norm);
  return {
    norm,
    bare: stripMatras(norm),
    roman,
    skel: skeleton(roman),
    tokens: roman.split(" ").filter((token) => token.length > 1),
  };
}

function tokenScore(token: string, doc: DocKeys): number {
  let best = 0;
  for (const form of expandToken(token)) {
    const script = normalizeText(form);
    const roman = foldLatin(romanize(form));
    const skel = skeleton(roman);
    if (script.length >= 2 && doc.norm.includes(script)) best = Math.max(best, 100);
    const bareForm = stripMatras(script);
    if (bareForm.length >= 4 && doc.bare.includes(bareForm)) best = Math.max(best, 90);
    if (roman.length >= 4 && doc.roman.includes(roman)) best = Math.max(best, 92);
    if (roman.length >= 2 && roman.length <= 3 && doc.tokens.some((item) => item === roman || item.startsWith(roman))) {
      best = Math.max(best, 88);
    }
    if (skel.length >= 4 && doc.skel.includes(skel)) best = Math.max(best, 80);
    if (roman.length >= 4) {
      for (const item of doc.tokens) {
        if (!item || item[0] !== roman[0]) continue;
        if (Math.abs(item.length - roman.length) > 2) continue;
        if (levenshtein(roman, item) <= 1) best = Math.max(best, 66);
      }
    }
  }
  return best;
}

export type PreparedDoc = DocKeys;

export function prepareFields(fields: string[]): PreparedDoc {
  return keysOf(fields.filter(Boolean).join("\n"));
}

export function scorePrepared(query: string, doc: PreparedDoc): number {
  const raw = query.trim();
  if (!raw) return 1;
  const tokens = normalizeText(raw).split(" ").filter((token) => token.length > 1 && !STOP.has(token));
  const parts = tokens.length ? tokens : [normalizeText(raw)].filter(Boolean);
  if (!parts.length) return 0;
  let matched = 0;
  let total = 0;
  for (const token of parts) {
    const score = tokenScore(token, doc);
    if (score > 0) matched += 1;
    total += score;
  }
  if (!matched) return 0;
  if (parts.length > 1 && matched / parts.length < 0.5) return 0;
  const average = total / parts.length;
  return parts.length > 1 && matched < parts.length ? Math.round(average * 0.65) : Math.round(average);
}

export function calculateRelevance(query: string, fields: string[]): number {
  return scorePrepared(query, prepareFields(fields));
}

export function rankPrepared<T>(rows: T[], query: string, docOf: (row: T) => PreparedDoc): T[] {
  const q = query.trim();
  if (!q) return rows;
  const needle = normalizeText(q);
  const bare = stripMatras(needle);
  const quick: Array<{ row: T; at: number }> = [];
  for (const row of rows) {
    const doc = docOf(row);
    const at = needle ? doc.norm.indexOf(needle) : -1;
    if (at >= 0) {
      quick.push({ row, at });
      continue;
    }
    if (bare.length >= 2) {
      const atBare = doc.bare.indexOf(bare);
      if (atBare >= 0) quick.push({ row, at: 1000 + atBare });
    }
  }
  if (quick.length) return quick.sort((a, b) => a.at - b.at).map((item) => item.row);
  return rows
    .map((row) => ({ row, score: scorePrepared(q, docOf(row)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
}

export function rankBySearch<T>(rows: T[], query: string, fields: (row: T) => string[]): T[] {
  const q = query.trim();
  if (!q) return rows;
  return rankPrepared(rows, q, (row) => prepareFields(fields(row)));
}
