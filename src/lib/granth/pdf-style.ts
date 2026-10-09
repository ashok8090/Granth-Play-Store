export type PdfStyle = "fill90" | "original";

export const PDF_STYLES: Array<{ id: PdfStyle; title: string; hint: string }> = [
  { id: "fill90", title: "PDF विषय के साथ", hint: "बड़ा चित्र, विषय ऊपर और पेज नीचे" },
  { id: "original", title: "केवल चित्र", hint: "सिर्फ़ मूल चित्र, पूरी गुणवत्ता, कोई लिखावट नहीं" },
];

const STYLE_KEY = "pdf-style";

export function savedPdfStyle(): PdfStyle {
  try {
    const value = localStorage.getItem(STYLE_KEY);
    if (value === "original") return "original";
  } catch {
    /* private mode */
  }
  return "fill90";
}

export function rememberPdfStyle(style: PdfStyle) {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    /* ignore */
  }
}
