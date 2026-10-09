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

const PAGE_INDEX = 8;

export function devanagariDigits(value: string): string {
  return value.replace(/[०-९]/g, (digit) => {
    const index = DIGITS.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}

export function isKabirSagar(title: string): boolean {
  return /कबीर\s*सागर|kabir\s*sagar/i.test(title);
}

export function pramanOrderKey(title: string): number[] {
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
}

const KABIR_CHAPTERS = [
  "ज्ञानसागर",
  "अनुरागसागर",
  "अम्बुसागर",
  "विवेकसागर",
  "सर्वज्ञसागर",
  "ज्ञानप्रकाश",
  "अमरसिंह बोध",
  "बीरसिंह बोध",
  "भोपाल बोध",
  "जगजीवन बोध",
  "गरुड़ बोध",
  "हनुमान बोध",
  "लक्ष्मण बोध",
  "मोहम्मद बोध",
  "काफिर बोध",
  "सुल्तान बोध",
  "निरंजन बोध",
  "ज्ञानबोध",
  "भवतारण बोध",
  "मुक्तिबोध",
  "चौकास्वरोदय",
  "अलिफनामा",
  "कबीरबानी",
  "कर्मबोध",
  "अमरमूल",
  "उग्रगीता",
  "ज्ञानस्थिति बोध",
  "संतोष बोध",
  "कायापांजी",
  "पंचमुद्रा",
  "आत्मबोध",
  "जैनधर्म बोध",
  "स्वसमवेद बोध",
  "धर्मबोध",
  "कमाल बोध",
  "स्वाश गुंजार",
  "अगमनिगम बोध",
  "सुमिरन बोध",
  "कबीरचरित्र बोध",
  "गुरु महात्म्य",
  "जीवधर्म बोध",
];

function kabirRank(title: string): { order: number; page: number } {
  const spaced = devanagariDigits(title).replace(/[़]/g, "");
  const compact = spaced.replace(/\s+/g, "");
  let order = KABIR_CHAPTERS.length + 5;
  const ranked = [...KABIR_CHAPTERS].sort((a, b) => b.length - a.length);
  for (const name of ranked) {
    const key = name.replace(/\s+/g, "");
    if (spaced.includes(name) || compact.includes(key)) {
      order = KABIR_CHAPTERS.indexOf(name);
      break;
    }
  }
  const pageMatch = spaced.match(/(?:पेज|पृष्ठ|page)\s*(?:नं\.?|नंबर|संख्या|number)?\s*[:\-–]?\s*(\d+)/i);
  const loose = pageMatch ? Number(pageMatch[1]) : Number(spaced.match(/(\d+)/)?.[1] ?? MISSING);
  return { order, page: Number.isFinite(loose) ? loose : MISSING };
}

function compareKeys(left: number[], right: number[], order: number[]): number {
  for (const index of order) {
    const delta = (left[index] ?? MISSING) - (right[index] ?? MISSING);
    if (delta) return delta;
  }
  return (left[FIELDS.length] ?? MISSING) - (right[FIELDS.length] ?? MISSING);
}

export function sortPramans<T extends { title: string; id?: string; granth_title?: string; granth_id?: string }>(
  rows: T[],
  granthTitle = "",
): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.granth_id ?? ""}|${granthTitle || row.granth_title || ""}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const sortGroup = (list: T[], title: string) => {
    if (isKabirSagar(title)) {
      return [...list].sort((a, b) => {
        const left = kabirRank(a.title);
        const right = kabirRank(b.title);
        if (left.order !== right.order) return left.order - right.order;
        if (left.page !== right.page) return left.page - right.page;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""), "en", { numeric: true });
      });
    }
    const pageFirst = [PAGE_INDEX, 4, 6, 7, 0, 1, 5, 2, 3];
    return [...list].sort((a, b) => {
      const delta = compareKeys(pramanOrderKey(a.title), pramanOrderKey(b.title), pageFirst);
      if (delta) return delta;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""), "en", { numeric: true });
    });
  };
  if (groups.size <= 1) return sortGroup(rows, granthTitle || rows[0]?.granth_title || "");
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "hi"))
    .flatMap(([key, list]) => sortGroup(list, key.split("|").slice(1).join("|")));
}
