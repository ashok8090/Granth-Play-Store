const SAFE_PATH = /^(granths|uploads)\/[A-Za-z0-9_.-]+$/;

/** Only scripture image paths from the Granth API — never an open proxy. */
export function mediaPath(input: string | null | undefined): string | null {
  if (!input) return null;
  let path = input.trim();
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  path = path.replace(/^\/+/, "");
  return SAFE_PATH.test(path) ? path : null;
}

const ORIGIN = "https://granth.wnmsolutions.com";

function inApk(): boolean {
  return typeof location !== "undefined" && location.protocol === "file:";
}

export function mediaUrl(path: string): string {
  if (inApk()) return `${ORIGIN}/${path}`;
  return `/api/media?src=${encodeURIComponent(path)}`;
}

export function youtubeId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  const embedded = value.match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/);
  return embedded?.[1] ?? null;
}

export function byPosition<T extends { position: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(a.position) - Number(b.position));
}

export function includesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const needle = query.trim();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").includes(needle));
}
