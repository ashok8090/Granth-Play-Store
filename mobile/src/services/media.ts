const SAFE_PATH = /^(granths|uploads)\/[A-Za-z0-9_.-]+$/;
export const ORIGIN = "https://granth.wnmsolutions.com";

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

export function remoteUrl(path: string): string {
  return `${ORIGIN}/${path.replace(/^\/+/, "")}`;
}

export function youtubeId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  const embedded = value.match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/);
  return embedded?.[1] ?? null;
}

export function fileSlug(path: string): string {
  return path.replace(/[^\w.-]+/g, "_");
}
