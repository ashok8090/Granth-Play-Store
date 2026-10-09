const DIGITS = "०१२३४५६७८९";
const MISSING = 1_000_000_000;
const TAIL = String.raw`(?:\s*(?:नं\.?|नंबर|संख्या|number))?\s*[:\-–]?\s*(\d+)`;

const FIELDS: RegExp[] = [
  new RegExp(String.raw`भाग${TAIL}`),
  new RegExp(String.raw`ख(?:ण्ड|ंड)${TAIL}`),
  new RegExp(String.raw`स्क(?:न्ध|ंध)${TAIL}`),
  new RegExp(String.raw`(?:मण्डल|मंडल)${TAIL}`),
  new RegExp(String.raw`अध्याय${TAIL}`),
  new RegExp(String.raw`सूक्त${TAIL}`),
  new RegExp(String.raw`श्लोक${TAIL}`),
  new RegExp(String.raw`(?:मंत्र|मन्त्र)${TAIL}`),
  new RegExp(String.raw`(?:पेज|पृष्ठ|page)${TAIL}`, "i"),
];

function devanagariDigits(value: string): string {
  return value.replace(/[०-९]/g, (digit) => {
    const index = DIGITS.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}

export function sortPramans<T extends { title: string; id?: string }>(rows: T[]): T[] {
  const keyOf = (title: string) => {
    const text = devanagariDigits(title);
    const keys = FIELDS.map((pattern) => {
      const match = text.match(pattern);
      return match ? Number(match[1]) : MISSING;
    });
    const allMissing = !keys.some((value) => value !== MISSING);
    if (allMissing) {
      const any = text.match(/(\d+)/);
      keys.push(any ? Number(any[1]) : MISSING);
    }
    return keys;
  };
  const keys = rows.map((row) => keyOf(row.title));
  const threshold = Math.max(2, Math.ceil(rows.length * 0.35));
  const active = FIELDS.map((_, index) => keys.filter((key) => (key[index] ?? MISSING) !== MISSING).length >= threshold);
  return [...rows].sort((a, b) => {
    const left = keyOf(a.title);
    const right = keyOf(b.title);
    for (let index = 0; index < FIELDS.length; index += 1) {
      if (!active[index]) continue;
      const delta = (left[index] ?? MISSING) - (right[index] ?? MISSING);
      if (delta) return delta;
    }
    const leftFallback = left.length > FIELDS.length ? (left[FIELDS.length] ?? MISSING) : MISSING;
    const rightFallback = right.length > FIELDS.length ? (right[FIELDS.length] ?? MISSING) : MISSING;
    if (leftFallback !== rightFallback) return leftFallback - rightFallback;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""), "en", { numeric: true });
  });
}
