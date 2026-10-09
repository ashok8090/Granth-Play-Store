import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { palette, type Palette } from "../theme/colors";
import type { Catalog, DownloadJob, GalleryFolder, GalleryItem, Granth, Praman, SaveMeta, Settings, Topic } from "../models/types";
import { listDownloads as readJobs, upsertLocalFile } from "../database/db";
import {
  collectImagePaths,
  DEFAULT_RESOURCE_VERSION,
  loadCachedCatalog,
  queueImageDownloads,
  rememberExistingImages,
  syncCatalog,
} from "../services/CatalogService";
import {
  cancelDownload,
  enqueueDownload,
  hydrateDownloads,
  pauseAll,
  pauseDownload,
  resumeAll,
  resumeDownload,
  retryDownload,
  snapshotDownloads,
  subscribeDownloads,
  waitForDownload,
} from "../services/DownloadService";
import {
  createFolder,
  deleteFolder,
  deleteItems,
  loadGalleryState,
  moveItems,
  renameFolder,
  saveCardPdf,
  saveImageCopy,
  shareItem,
} from "../services/GalleryService";
import { importResourcePack, parseResourcePackBytes } from "../services/ResourcePackService";
import { loadSettings, saveSettings } from "../services/settings";
import { ensureDirs, packUri, readBytes } from "../services/StorageService";

type Status = "booting" | "ready" | "syncing" | "offline" | "error";

type Filter = { topicId?: string; granthId?: string };

type AppValue = {
  colors: Palette;
  settings: Settings;
  setGranthCols: (cols: 1 | 2 | 3) => void;
  setPramanCols: (cols: 1 | 2) => void;
  setGalleryCols: (cols: 1 | 2) => void;
  toggleTheme: () => void;
  status: Status;
  error: string | null;
  catalog: Catalog;
  localFiles: Record<string, string>;
  resourceVersion: string;
  jobs: DownloadJob[];
  toast: string | null;
  ping: (message: string) => void;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  refresh: () => Promise<void>;
  saveImage: (path: string, meta: SaveMeta) => Promise<void>;
  savePdf: (input: Parameters<typeof saveCardPdf>[0]) => Promise<void>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => void;
  retry: (id: string) => void;
  cancel: (id: string) => Promise<void>;
  pauseEverything: () => Promise<void>;
  resumeEverything: () => void;
  folders: GalleryFolder[];
  items: GalleryItem[];
  reloadGallery: () => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  editFolder: (id: string, name: string) => Promise<void>;
  dropFolder: (id: string) => Promise<void>;
  moveToFolder: (ids: string[], folderId: string) => Promise<void>;
  dropItems: (ids: string[]) => Promise<void>;
  shareGallery: (id: string) => Promise<void>;
  importPackUrl: (url: string) => Promise<void>;
};

const EMPTY: Catalog = { topics: [], granths: [], pramans: [], syncedAt: 0 };
const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ granthCols: 2, pramanCols: 1, galleryCols: 2, theme: "paper" });
  const [status, setStatus] = useState<Status>("booting");
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
  const [localFiles, setLocalFiles] = useState<Record<string, string>>({});
  const [resourceVersion, setResourceVersion] = useState(DEFAULT_RESOURCE_VERSION);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({});
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [items, setItems] = useState<GalleryItem[]>([]);

  const ping = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  const applyCatalog = useCallback(async (next: Catalog) => {
    setCatalog(next);
    const paths = collectImagePaths(next);
    const have = await rememberExistingImages(paths);
    setLocalFiles(have);
    queueImageDownloads(paths, have);
    setJobs(snapshotDownloads());
  }, []);

  const refresh = useCallback(async () => {
    setStatus("syncing");
    setError(null);
    try {
      const next = await syncCatalog();
      await applyCatalog(next);
      setResourceVersion(DEFAULT_RESOURCE_VERSION);
      setStatus("ready");
      ping("नया संग्रह सहेज लिया");
    } catch (err) {
      setStatus(catalog.syncedAt ? "offline" : "error");
      const message = catalog.syncedAt ? "नया डेटा नहीं मिला — सहेजा हुआ संग्रह चल रहा है।" : "पहली बार इंटरनेट चाहिए, फिर ऐप ऑफलाइन चलेगा।";
      setError(message);
      ping(err instanceof Error ? message : message);
    }
  }, [applyCatalog, catalog.syncedAt, ping]);

  useEffect(() => {
    return subscribeDownloads(() => {
      const next = snapshotDownloads();
      setJobs(next);
      setLocalFiles((current) => {
        let changed = false;
        const copy = { ...current };
        for (const job of next) {
          if (job.status === "done" && job.sourcePath && job.dest && copy[job.sourcePath] !== job.dest) {
            copy[job.sourcePath] = job.dest;
            changed = true;
            void upsertLocalFile(job.sourcePath, job.dest, job.bytes);
          }
        }
        return changed ? copy : current;
      });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensureDirs();
        const [storedSettings, cached, savedJobs, gallery] = await Promise.all([
          loadSettings(),
          loadCachedCatalog(),
          readJobs(),
          loadGalleryState(),
        ]);
        if (!alive) return;
        setSettings(storedSettings);
        setFolders(gallery.folders);
        setItems(gallery.items);
        hydrateDownloads(savedJobs);
        setJobs(snapshotDownloads());
        if (cached) {
          setCatalog(cached);
          setStatus("ready");
          const paths = collectImagePaths(cached);
          const have = await rememberExistingImages(paths);
          if (!alive) return;
          setLocalFiles(have);
          queueImageDownloads(paths, have);
          setJobs(snapshotDownloads());
        }
        try {
          const next = await syncCatalog();
          if (!alive) return;
          await applyCatalog(next);
          setStatus("ready");
        } catch {
          if (!alive) return;
          if (cached) {
            setStatus("offline");
            setError("नया डेटा नहीं मिला — सहेजा हुआ संग्रह चल रहा है।");
          } else {
            setStatus("error");
            setError("पहली बार इंटरनेट चाहिए, फिर ऐप ऑफलाइन चलेगा।");
          }
        }
      } catch (err) {
        if (!alive) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Database error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyCatalog]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const reloadGallery = useCallback(async () => {
    const gallery = await loadGalleryState();
    setFolders(gallery.folders);
    setItems(gallery.items);
  }, []);

  const value = useMemo<AppValue>(() => ({
    colors: palette(settings.theme),
    settings,
    setGranthCols: (granthCols) => updateSettings({ ...settings, granthCols }),
    setPramanCols: (pramanCols) => updateSettings({ ...settings, pramanCols }),
    setGalleryCols: (galleryCols) => updateSettings({ ...settings, galleryCols }),
    toggleTheme: () => updateSettings({ ...settings, theme: settings.theme === "paper" ? "night" : "paper" }),
    status,
    error,
    catalog,
    localFiles,
    resourceVersion,
    jobs,
    toast,
    ping,
    filter,
    setFilter,
    refresh,
    saveImage: async (path, meta) => {
      try {
        ping(await saveImageCopy(path, meta));
        await reloadGallery();
      } catch (err) {
        ping(err instanceof Error ? err.message : "Download failed");
      }
    },
    savePdf: async (input) => {
      ping("PDF बन रहा है…");
      try {
        ping(await saveCardPdf(input));
        await reloadGallery();
      } catch (err) {
        ping(err instanceof Error ? err.message : "Download failed");
      }
    },
    pause: pauseDownload,
    resume: resumeDownload,
    retry: retryDownload,
    cancel: cancelDownload,
    pauseEverything: pauseAll,
    resumeEverything: resumeAll,
    folders,
    items,
    reloadGallery,
    addFolder: async (name) => {
      await createFolder(name);
      await reloadGallery();
      ping("Folder created");
    },
    editFolder: async (id, name) => {
      await renameFolder(id, name);
      await reloadGallery();
    },
    dropFolder: async (id) => {
      await deleteFolder(id);
      await reloadGallery();
    },
    moveToFolder: async (ids, folderId) => {
      await moveItems(ids, folderId);
      await reloadGallery();
    },
    dropItems: async (ids) => {
      await deleteItems(ids);
      await reloadGallery();
      ping("Deleted");
    },
    shareGallery: async (id) => {
      try {
        await shareItem(id);
      } catch (err) {
        ping(err instanceof Error ? err.message : "Share failed");
      }
    },
    importPackUrl: async (url) => {
      const dest = packUri(`pack-${Date.now()}.json`);
      const job = enqueueDownload({ id: `pack:${url}`, kind: "pack", title: "Resource pack", url, dest, priority: true });
      const done = await waitForDownload(job.id);
      if (done.status !== "done") throw new Error(done.error ?? "Download failed");
      const text = await readBytes(dest);
      const pack = parseResourcePackBytes(text);
      const next = await importResourcePack(pack);
      await applyCatalog(next);
      setResourceVersion(pack.resourceVersion);
      ping(`Pack ${pack.resourceVersion} imported`);
    },
  }), [
    applyCatalog, catalog, error, filter, folders, items, jobs, localFiles, ping, refresh, reloadGallery,
    resourceVersion, settings, status, toast, updateSettings,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp outside provider");
  return value;
}

export type { Topic, Granth, Praman };
