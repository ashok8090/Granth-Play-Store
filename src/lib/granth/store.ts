import { create } from "zustand";
import { countImages, hasImage, readCatalog, readImage, savedImagePaths, writeCatalog, writeImage } from "./db";
import { mediaPath, mediaUrl } from "./media";
import { applyPublishedOverlay } from "./admin-db";
import { noteEvent } from "./metrics";
import type { ApiEnvelope, Catalog, Granth, Praman, Topic } from "./types";

export type SyncStatus = "booting" | "syncing" | "ready" | "offline" | "error";

type ImageJob = {
  done: number;
  total: number;
  running: boolean;
};

type GranthState = {
  topics: Topic[];
  granths: Granth[];
  pramans: Praman[];
  syncedAt: number | null;
  status: SyncStatus;
  online: boolean;
  error: string | null;
  images: ImageJob;
  booted: boolean;
  boot: () => Promise<void>;
  sync: () => Promise<void>;
  savePages: () => void;
  stopSave: () => void;
};

let bootOnce: Promise<void> | null = null;
let saveToken = 0;
let lastServer: Catalog | null = null;

export function serverCatalog(): Catalog | null {
  return lastServer;
}

const ORIGIN = "https://granth.wnmsolutions.com";

function inApk(): boolean {
  return typeof location !== "undefined" && location.protocol === "file:";
}

async function pullList<T>(request: string): Promise<T[]> {
  const url = inApk()
    ? `${ORIGIN}/api/index.php?request=${encodeURIComponent(request)}`
    : `/api/granth?request=${request}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${request} failed`);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!body.success || !Array.isArray(body.data)) throw new Error(`${request} empty`);
  return body.data;
}

async function pullCatalog(): Promise<Catalog> {
  if (inApk()) {
    const [topics, granths, pramans] = await Promise.all([
      pullList<Topic>("getTopics"),
      pullList<Granth>("getGranths"),
      pullList<Praman>("getPramans"),
    ]);
    return { topics, granths, pramans, syncedAt: Date.now() };
  }
  try {
    const response = await fetch("/api/granth?request=bundle");
    if (response.ok) {
      const body = (await response.json()) as {
        success?: boolean;
        data?: { topics?: Topic[]; granths?: Granth[]; pramans?: Praman[] };
      };
      if (body.success && Array.isArray(body.data?.topics) && Array.isArray(body.data?.granths) && Array.isArray(body.data?.pramans)) {
        return { topics: body.data.topics, granths: body.data.granths, pramans: body.data.pramans, syncedAt: Date.now() };
      }
    }
  } catch {
    /* older server — fall through */
  }
  const [topics, granths, pramans] = await Promise.all([
    pullList<Topic>("getTopics"),
    pullList<Granth>("getGranths"),
    pullList<Praman>("getPramans"),
  ]);
  return { topics, granths, pramans, syncedAt: Date.now() };
}

function imageGroups(catalog: Catalog): { first: string[]; rest: string[] } {
  const seen = new Set<string>();
  const take = (bucket: string[], value: string | null | undefined) => {
    const path = mediaPath(value);
    if (!path || seen.has(path)) return;
    seen.add(path);
    bucket.push(path);
  };
  const first: string[] = [];
  const rest: string[] = [];
  for (const granth of catalog.granths) {
    take(first, granth.imagePath);
    take(first, granth.editorImagePath);
  }
  for (const praman of catalog.pramans) {
    take(rest, praman.granth_image);
    take(rest, praman.image_path);
    take(rest, praman.editorImagePath);
  }
  return { first, rest };
}

function collectImagePaths(catalog: Catalog): string[] {
  const groups = imageGroups(catalog);
  return [...groups.first, ...groups.rest];
}

async function cacheImage(path: string): Promise<boolean> {
  if (await hasImage(path)) return true;
  const response = await fetch(mediaUrl(path));
  if (!response.ok) return false;
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size < 32) return false;
  await writeImage(path, blob);
  return true;
}

export const useGranth = create<GranthState>((set, get) => ({
  topics: [],
  granths: [],
  pramans: [],
  syncedAt: null,
  status: "booting",
  online: true,
  error: null,
  images: { done: 0, total: 0, running: false },
  booted: false,
  boot: () => {
    if (bootOnce) return bootOnce;
    bootOnce = (async () => {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      set({ online, booted: true });
      try {
        const cached = await readCatalog();
        if (cached) {
          const saved = await countImages().catch(() => 0);
          set({
            topics: cached.topics,
            granths: cached.granths,
            pramans: cached.pramans,
            syncedAt: cached.syncedAt,
            status: online ? "ready" : "offline",
            images: { done: saved, total: collectImagePaths(cached).length, running: false },
          });
        }
      } catch {
        /* first run has no store */
      }
      if (online) {
        void get().sync().finally(() => {
          if (get().topics.length || get().granths.length) get().savePages();
        });
      } else if (get().topics.length || get().granths.length) {
        set({ status: "offline", online: false, error: null });
      } else {
        set({
          status: "error",
          online: false,
          error: "डेटा नहीं आ पाया। इंटरनेट चेक करके फिर सिंक करें।",
        });
      }
    })();
    return bootOnce;
  },
  sync: async () => {
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      const hasCache = Boolean(get().topics.length || get().granths.length || get().syncedAt);
      set({
        online: false,
        status: hasCache ? "offline" : "error",
        error: hasCache ? null : "डेटा नहीं आ पाया। इंटरनेट चेक करके फिर सिंक करें।",
      });
      return;
    }
    set({ status: "syncing", online: true, error: null });
    try {
      const pulled = await pullCatalog();
      lastServer = pulled;
      const catalog = await applyPublishedOverlay(lastServer);
      await writeCatalog(catalog);
      const saved = await countImages().catch(() => 0);
      set({
        topics: catalog.topics,
        granths: catalog.granths,
        pramans: catalog.pramans,
        syncedAt: catalog.syncedAt,
        status: "ready",
        error: null,
        images: { done: saved, total: collectImagePaths(catalog).length, running: get().images.running },
      });
      noteEvent("sync", "catalog");
    } catch {
      const hasCache = Boolean(get().syncedAt);
      set({
        status: hasCache ? "ready" : "error",
        error: hasCache
          ? "नया डेटा नहीं मिला। सेव की हुई कॉपी चल रही है।"
          : "डेटा नहीं आ पाया। इंटरनेट चेक करके फिर सिंक करें।",
      });
    }
  },
  savePages: () => {
    const catalog: Catalog = {
      topics: get().topics,
      granths: get().granths,
      pramans: get().pramans,
      syncedAt: get().syncedAt ?? Date.now(),
    };
    const groups = imageGroups(catalog);
    const paths = [...groups.first, ...groups.rest];
    if (!paths.length) return;
    const token = ++saveToken;
    set({ images: { done: get().images.done, total: paths.length, running: true } });
    void (async () => {
      const have = await savedImagePaths(paths);
      let done = 0;
      const pendingFirst: string[] = [];
      const pendingRest: string[] = [];
      for (const path of groups.first) {
        if (have.has(path)) done += 1;
        else pendingFirst.push(path);
      }
      for (const path of groups.rest) {
        if (have.has(path)) done += 1;
        else pendingRest.push(path);
      }
      if (token !== saveToken) return;
      set({ images: { done, total: paths.length, running: pendingFirst.length + pendingRest.length > 0 } });
      const drain = async (pending: string[]) => {
        let cursor = 0;
        const worker = async () => {
          while (token === saveToken) {
            const index = cursor;
            cursor += 1;
            if (index >= pending.length) return;
            const path = pending[index];
            if (!path) return;
            try {
              await cacheImage(path);
            } catch {
              /* keep going — text library still works */
            }
            done += 1;
            if (token === saveToken && (done % 3 === 0 || done === paths.length)) {
              set({ images: { done, total: paths.length, running: done < paths.length } });
            }
          }
        };
        const width = Math.min(6, pending.length);
        if (width > 0) await Promise.all(Array.from({ length: width }, () => worker()));
      };
      await drain(pendingFirst);
      await drain(pendingRest);
      if (token === saveToken) {
        set({ images: { done: paths.length, total: paths.length, running: false } });
      }
    })();
  },
  stopSave: () => {
    saveToken += 1;
    set({ images: { done: get().images.done, total: get().images.total, running: false } });
  },
}));

export async function refreshAdminOverlay(): Promise<void> {
  if (!lastServer) return;
  const merged = await applyPublishedOverlay({ ...lastServer, syncedAt: Date.now() });
  await writeCatalog(merged);
  useGranth.setState({
    topics: merged.topics,
    granths: merged.granths,
    pramans: merged.pramans,
    syncedAt: merged.syncedAt,
    status: "ready",
  });
}

export async function cachedObjectUrl(path: string): Promise<string | null> {
  const blob = await readImage(path);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
