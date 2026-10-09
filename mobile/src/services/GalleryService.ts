import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import {
  getGalleryItem,
  getMeta,
  listFolders,
  listGallery,
  moveGalleryItems,
  removeFolder,
  removeGalleryItems,
  saveFolder,
  saveGalleryItem,
  setMeta,
  upsertLocalFile,
} from "../database/db";
import type { GalleryFolder, GalleryItem, SaveMeta } from "../models/types";
import { enqueueDownload, waitForDownload } from "./DownloadService";
import { mediaPath, remoteUrl } from "./media";
import { buildCardPdf } from "./PdfService";
import { bytesToBase64, fileReady, freeBytes, galleryUri, imageCacheUri, pdfUri, readBytes, writeBytes } from "./StorageService";

const ALBUM = "ग्रंथ प्रबंधन";

async function publishImage(uri: string): Promise<"saved" | "in-app"> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return "in-app";
  const asset = await MediaLibrary.createAssetAsync(uri);
  const existing = await MediaLibrary.getAlbumAsync(ALBUM).catch(() => null);
  if (existing) await MediaLibrary.addAssetsToAlbumAsync([asset], existing, false);
  else await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
  return "saved";
}

async function publishPdf(fileName: string, bytes: Uint8Array): Promise<boolean> {
  let directory = await getMeta("safDirectory");
  if (!directory) {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return false;
    directory = permission.directoryUri;
    await setMeta("safDirectory", directory);
  }
  const target = await FileSystem.StorageAccessFramework.createFileAsync(directory, fileName, "application/pdf");
  await FileSystem.writeAsStringAsync(target, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return true;
}

export async function loadGalleryState(): Promise<{ folders: GalleryFolder[]; items: GalleryItem[] }> {
  const [folders, items] = await Promise.all([listFolders(), listGallery()]);
  return { folders, items };
}

export async function createFolder(name: string): Promise<GalleryFolder> {
  const folder: GalleryFolder = { id: `fld-${Date.now()}`, name: name.trim(), createdAt: Date.now() };
  if (!folder.name) throw new Error("Folder name is empty");
  await saveFolder(folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folders = await listFolders();
  const current = folders.find((folder) => folder.id === id);
  if (!current) return;
  await saveFolder({ ...current, name: name.trim() || current.name });
}

export async function deleteFolder(id: string): Promise<void> {
  await removeFolder(id);
}

export async function moveItems(ids: string[], folderId: string): Promise<void> {
  await moveGalleryItems(ids, folderId);
}

export async function deleteItems(ids: string[]): Promise<void> {
  const items = await listGallery();
  const doomed = items.filter((item) => ids.includes(item.id));
  await removeGalleryItems(ids);
  await Promise.all(doomed.map((item) => FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => undefined)));
}

export async function shareItem(id: string): Promise<void> {
  const item = await getGalleryItem(id);
  if (!item) throw new Error("File missing");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable");
  await Sharing.shareAsync(item.localUri, {
    dialogTitle: item.title,
    mimeType: item.kind === "pdf" ? "application/pdf" : "image/jpeg",
    UTI: item.kind === "pdf" ? "com.adobe.pdf" : "public.jpeg",
  });
}

async function ensureCached(path: string): Promise<{ uri: string; size: number }> {
  const dest = imageCacheUri(path);
  const ready = await fileReady(dest);
  if (ready.ok) return { uri: dest, size: ready.size };
  const free = await freeBytes();
  if (free < 8 * 1024 * 1024) throw new Error("Insufficient storage");
  const job = enqueueDownload({
    id: `img:${path}`,
    kind: "image",
    title: path.split("/").pop() ?? path,
    url: remoteUrl(path),
    dest,
    sourcePath: path,
    priority: true,
  });
  const done = await waitForDownload(job.id);
  if (done.status !== "done") throw new Error(done.error ?? "Download failed");
  const after = await fileReady(dest);
  await upsertLocalFile(path, dest, after.size);
  return { uri: dest, size: after.size };
}

export async function saveImageCopy(path: string, meta: SaveMeta): Promise<string> {
  const safe = mediaPath(path);
  if (!safe) throw new Error("Missing image");
  const id = `img-${safe}`;
  const existing = await getGalleryItem(id);
  if (existing) {
    const ready = await fileReady(existing.localUri);
    if (ready.ok) return "Already downloaded";
  }
  const cached = await ensureCached(safe);
  const fileName = `${(meta.title || safe).slice(0, 40).replace(/[^\w\u0900-\u097F -]+/g, "") || "image"}.jpg`;
  const dest = galleryUri(`${id}.jpg`);
  await FileSystem.copyAsync({ from: cached.uri, to: dest });
  const info = await fileReady(dest);
  const item: GalleryItem = {
    id,
    kind: "image",
    title: meta.title,
    text: meta.text,
    topic: meta.topic,
    granth: meta.granth,
    folderId: existing?.folderId ?? "",
    createdAt: Date.now(),
    size: info.size || cached.size,
    fileName,
    localUri: dest,
    sourceId: meta.sourceId || safe,
  };
  await saveGalleryItem(item);
  const where = await publishImage(dest);
  return where === "saved" ? "Image saved" : "Image saved in app gallery";
}

export async function saveCardPdf(input: {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  meta?: string;
  imagePath?: string | null;
  topic: string;
  granth: string;
}): Promise<string> {
  const id = `pdf-${input.id}`;
  const existing = await getGalleryItem(id);
  if (existing && (await fileReady(existing.localUri)).ok) return "Already downloaded";
  const free = await freeBytes();
  if (free < 12 * 1024 * 1024) throw new Error("Insufficient storage");
  let imageBytes: Uint8Array | null = null;
  const safe = mediaPath(input.imagePath);
  if (safe) {
    try {
      const cached = await ensureCached(safe);
      imageBytes = await readBytes(cached.uri);
    } catch {
      imageBytes = null;
    }
  }
  const bytes = await buildCardPdf({
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    meta: input.meta,
    imageBytes,
  });
  const fileName = `${input.id}.pdf`;
  const dest = pdfUri(fileName);
  await writeBytes(dest, bytes);
  const info = await fileReady(dest);
  await saveGalleryItem({
    id,
    kind: "pdf",
    title: input.title,
    text: [input.subtitle, input.body, input.meta].filter(Boolean).join("\n"),
    topic: input.topic,
    granth: input.granth,
    folderId: existing?.folderId ?? "",
    createdAt: Date.now(),
    size: info.size || bytes.length,
    fileName,
    localUri: dest,
    sourceId: input.id,
  });
  const exported = await publishPdf(fileName, bytes).catch(() => false);
  return exported ? "PDF downloaded" : "PDF downloaded";
}
