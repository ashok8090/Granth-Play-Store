import * as FileSystem from "expo-file-system/legacy";
import { fileSlug } from "./media";

export function documentRoot(): string {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error("App storage is unavailable");
  return root;
}

export function imageCacheUri(path: string): string {
  return `${documentRoot()}granth/images/${fileSlug(path)}`;
}

export function galleryUri(fileName: string): string {
  return `${documentRoot()}granth/gallery/${fileSlug(fileName)}`;
}

export function pdfUri(fileName: string): string {
  const name = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  return `${documentRoot()}granth/pdfs/${fileSlug(name)}`;
}

export function packUri(fileName: string): string {
  return `${documentRoot()}granth/packs/${fileSlug(fileName)}`;
}

export async function ensureDirs(): Promise<void> {
  const root = documentRoot();
  for (const folder of ["granth/images", "granth/gallery", "granth/pdfs", "granth/packs"]) {
    await FileSystem.makeDirectoryAsync(`${root}${folder}`, { intermediates: true });
  }
}

export async function fileReady(uri: string): Promise<{ ok: boolean; size: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) return { ok: false, size: 0 };
  return { ok: info.size > 32, size: info.size };
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += alphabet[(triple >> 18) & 63] ?? "";
    out += alphabet[(triple >> 12) & 63] ?? "";
    out += b === undefined ? "=" : (alphabet[(triple >> 6) & 63] ?? "");
    out += c === undefined ? "=" : (alphabet[triple & 63] ?? "");
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8Array((clean.length * 3) >> 2);
  let pos = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i] ?? "A");
    const b = alphabet.indexOf(clean[i + 1] ?? "A");
    const cChar = clean[i + 2];
    const dChar = clean[i + 3];
    const c = cChar ? alphabet.indexOf(cChar) : -1;
    const d = dChar ? alphabet.indexOf(dChar) : -1;
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    out[pos] = (n >> 16) & 255;
    pos += 1;
    if (c >= 0) {
      out[pos] = (n >> 8) & 255;
      pos += 1;
    }
    if (d >= 0) {
      out[pos] = n & 255;
      pos += 1;
    }
  }
  return out.subarray(0, pos);
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToBytes(b64);
}

export async function writeBytes(uri: string, bytes: Uint8Array): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
}

export async function freeBytes(): Promise<number> {
  return FileSystem.getFreeDiskStorageAsync();
}

const IMAGE_MAGIC = [/^\/9j\//, /^iVBOR/, /^R0lG/, /^UklGR/];

export async function looksLikeImage(uri: string): Promise<boolean> {
  try {
    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 16,
    });
    return IMAGE_MAGIC.some((pattern) => pattern.test(head));
  } catch {
    return false;
  }
}
