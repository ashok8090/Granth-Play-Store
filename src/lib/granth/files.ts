export type ToastFile = {
  blob: Blob;
  name: string;
};

export type ToastPayload = {
  message: string;
  file?: ToastFile;
};

export function ping(message: string | ToastPayload) {
  const detail: ToastPayload = typeof message === "string" ? { message } : message;
  window.dispatchEvent(new CustomEvent("granth-toast", { detail }));
}

type NativeBridge = { postMessage: (message: string) => void };

type GranthWindow = Window & {
  ReactNativeWebView?: NativeBridge;
  __granthOpenMiss?: (name: string) => void;
  __granthShareHit?: (name: string) => void;
  __granthShareMiss?: (name: string) => void;
};

function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as GranthWindow).ReactNativeWebView;
  return bridge && typeof bridge.postMessage === "function" ? bridge : null;
}

const SITE = "https://granth.grok.me/open";

export function publicLink(kind: "topic" | "granth" | "praman", id: string) {
  if (!id) return "granth://open";
  const key = kind === "praman" ? "id" : kind;
  return `${SITE}?${key}=${encodeURIComponent(id)}`;
}

export function openExternal(url: string) {
  const bridge = nativeBridge();
  if (bridge) {
    bridge.postMessage(JSON.stringify({ type: "open-url", url }));
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function shareLink(title: string, url: string) {
  const text = url ? `${title}\n${url}` : title;
  const bridge = nativeBridge();
  if (bridge) {
    bridge.postMessage(JSON.stringify({ type: "share-text", title, url, text }));
    return;
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    ping("लिंक कॉपी हो गया");
  } catch {
    ping(text);
  }
}

export function openMail(email: string) {
  const bridge = nativeBridge();
  if (bridge) {
    bridge.postMessage(JSON.stringify({ type: "open-mail", email }));
    return;
  }
  window.location.href = `mailto:${email}`;
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts: string[] = [];
  const size = 32766;
  for (let index = 0; index < bytes.length; index += size) {
    let binary = "";
    const slice = bytes.subarray(index, index + size);
    for (let offset = 0; offset < slice.length; offset += 0x8000) {
      binary += String.fromCharCode(...slice.subarray(offset, offset + 0x8000));
    }
    parts.push(btoa(binary));
    if (parts.length % 6 === 0) await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  return parts.join("");
}

const openBlobs = new Map<string, Blob>();
const saving = new Map<string, Promise<void>>();

function rememberOpen(name: string, blob: Blob) {
  openBlobs.set(name, blob);
  const host = window as GranthWindow;
  host.__granthOpenMiss = (missed) => {
    const stored = openBlobs.get(missed) ?? openBlobs.get(name);
    if (!stored) return;
    openBlobs.delete(missed);
    void handoff(stored, missed, "open");
  };
}

async function sendChunks(blob: Blob, name: string, data: string, mode: "save" | "share" | "open") {
  const bridge = nativeBridge();
  if (!bridge) return false;
  const size = 96_000;
  const total = Math.max(1, Math.ceil(data.length / size));
  const id = `${Date.now()}-${name}`;
  const type = mode === "share" ? "share-chunk" : mode === "open" ? "open-chunk" : "save-chunk";
  for (let index = 0; index < total; index += 1) {
    bridge.postMessage(JSON.stringify({
      type,
      id,
      name,
      mime: blob.type || (name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
      index,
      total,
      data: data.slice(index * size, (index + 1) * size),
    }));
    if (index % 2 === 1) await new Promise((resolve) => window.setTimeout(resolve, 12));
  }
  return true;
}

async function handoff(blob: Blob, name: string, mode: "save" | "share" | "open") {
  if (blob.size < 64) return false;
  const data = nativeBridge() ? await blobBase64(blob) : "";
  return Boolean(data && await sendChunks(blob, name, data, mode));
}

export function deliverFile(blob: Blob, fileName: string) {
  const job = (async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    if (await handoff(blob, fileName, "save")) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  })();
  saving.set(fileName, job);
  void job.finally(() => {
    if (saving.get(fileName) === job) saving.delete(fileName);
  });
  return job;
}

function askShareSaved(name: string) {
  const bridge = nativeBridge();
  if (!bridge) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 1500);
    const host = window as GranthWindow;
    host.__granthShareHit = (hit) => {
      if (hit !== name) return;
      window.clearTimeout(timer);
      resolve(true);
    };
    host.__granthShareMiss = (miss) => {
      if (miss !== name) return;
      window.clearTimeout(timer);
      resolve(false);
    };
    bridge.postMessage(JSON.stringify({ type: "share-saved", name }));
  });
}

export async function shareBlob(blob: Blob, fileName: string) {
  if (nativeBridge()) {
    const pending = saving.get(fileName);
    if (pending) {
      try {
        await pending;
      } catch {
        /* share the bytes anyway */
      }
    }
    if (!(await askShareSaved(fileName))) await handoff(blob, fileName, "share");
    return;
  }
  const file = new File([blob], fileName, { type: blob.type || "application/pdf" });
  if (typeof navigator.share === "function") {
    const canFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    try {
      if (canFiles) await navigator.share({ files: [file], title: fileName });
      else await navigator.share({ title: fileName, text: fileName });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await deliverFile(blob, fileName);
}

export async function openBlob(blob: Blob, fileName: string) {
  const bridge = nativeBridge();
  if (bridge) {
    rememberOpen(fileName, blob);
    bridge.postMessage(JSON.stringify({ type: "open-saved", name: fileName }));
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function saveBlob(blob: Blob, fileName: string) {
  deliverFile(blob, fileName);
}
