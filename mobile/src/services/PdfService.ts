import { Asset } from "expo-asset";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readBytes } from "./StorageService";

export type CardPdfInput = {
  title: string;
  subtitle?: string;
  body?: string;
  meta?: string;
  imageBytes?: Uint8Array | null;
};

let fontBytes: Uint8Array | null = null;

async function loadFont(): Promise<Uint8Array> {
  if (fontBytes) return fontBytes;
  const asset = Asset.fromModule(require("../../assets/fonts/NotoSansDevanagari-Regular.ttf"));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  fontBytes = await readBytes(uri);
  return fontBytes;
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildCardPdf(input: CardPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });
  const ink = rgb(0.29, 0.12, 0.04);
  const maroon = rgb(0.48, 0.12, 0.18);
  const muted = rgb(0.45, 0.32, 0.18);
  const margin = 40;
  const pageWidth = 595;
  const pageHeight = 842;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = (): PDFPage => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    return page;
  };

  const writeLines = (text: string, size: number, color: ReturnType<typeof rgb>, gap = 4) => {
    const maxWidth = pageWidth - margin * 2;
    for (const line of wrapLines(font, text, size, maxWidth)) {
      if (y < margin + size) newPage();
      page.drawText(line || " ", { x: margin, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  writeLines(input.title || "ग्रंथ प्रबंधन", 18, maroon, 8);
  if (input.subtitle) writeLines(input.subtitle, 12, muted, 8);
  const bytes = input.imageBytes;
  if (bytes && bytes.length > 32) {
    try {
      const image = bytes[0] === 0x89 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const maxW = pageWidth - margin * 2;
      const maxH = 280;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const width = image.width * scale;
      const height = image.height * scale;
      if (y - height < margin) newPage();
      y -= height;
      page.drawImage(image, { x: margin, y, width, height });
      y -= 16;
    } catch {
      writeLines("चित्र इस PDF में नहीं जुड़ सका। पाठ नीचे है।", 10, muted, 8);
    }
  }
  if (input.body) writeLines(input.body, 12, ink, 5);
  if (input.meta) {
    y -= 6;
    writeLines(input.meta, 10, muted, 3);
  }
  return doc.save();
}
