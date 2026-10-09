import { listLocalFiles, readCatalog, replaceCatalog, setMeta, upsertLocalFile } from "../database/db";
import type { Catalog, Granth, Praman, Topic } from "../models/types";
import { enqueueDownload } from "./DownloadService";
import { mediaPath, ORIGIN, remoteUrl } from "./media";
import { fileReady, imageCacheUri } from "./StorageService";

const RESOURCE_VERSION = "1.0.0";

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function asTopic(row: Record<string, unknown>): Topic {
  return {
    id: str(row.id),
    title: str(row.title),
    description: str(row.description),
    position: str(row.position),
    user: str(row.user),
    created_at: str(row.created_at),
    granth_count: str(row.granth_count),
    praman_count: str(row.praman_count),
  };
}

function asGranth(row: Record<string, unknown>): Granth {
  return {
    id: str(row.id),
    title: str(row.title),
    author: str(row.author ?? row.auther),
    topic_id: row.topic_id == null ? null : str(row.topic_id),
    description: str(row.description),
    imagePath: str(row.imagePath ?? row.image_path),
    editorImagePath: str(row.editorImagePath ?? row.editor_image),
    position: str(row.position),
    user: str(row.user),
    created_at: str(row.created_at),
    pramanCount: str(row.pramanCount ?? row.praman_count),
  };
}

function asPraman(row: Record<string, unknown>): Praman {
  return {
    id: str(row.id),
    title: str(row.title),
    description: str(row.description),
    is_favorate: str(row.is_favorate),
    topic_id: str(row.topic_id),
    granth_id: str(row.granth_id),
    image_path: str(row.image_path),
    youtube_url: str(row.youtube_url),
    youtube_start: str(row.youtube_start),
    youtube_desc: str(row.youtube_desc),
    user: str(row.user),
    created_at: str(row.created_at),
    topic_title: str(row.topic_title),
    granth_title: str(row.granth_title),
    granth_image: str(row.granth_image),
    editorImagePath: str(row.editorImagePath),
    granth_auther: str(row.granth_auther ?? row.granth_author),
  };
}

async function pull(request: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${ORIGIN}/api/index.php?request=${request}`);
  if (!response.ok) throw new Error(`${request} failed`);
  const body = (await response.json()) as { success?: boolean; data?: unknown };
  if (!body.success || !Array.isArray(body.data)) throw new Error(`${request} empty`);
  return body.data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
}

export function collectImagePaths(catalog: Catalog): string[] {
  const paths = new Set<string>();
  const push = (value: string | null | undefined) => {
    const path = mediaPath(value);
    if (path) paths.add(path);
  };
  for (const granth of catalog.granths) {
    push(granth.imagePath);
    push(granth.editorImagePath);
  }
  for (const praman of catalog.pramans) {
    push(praman.image_path);
    push(praman.granth_image);
    push(praman.editorImagePath);
  }
  return [...paths];
}

export async function loadCachedCatalog(): Promise<Catalog | null> {
  return readCatalog();
}

export async function syncCatalog(): Promise<Catalog> {
  const [topics, granths, pramans] = await Promise.all([
    pull("getTopics").then((rows) => rows.map(asTopic)),
    pull("getGranths").then((rows) => rows.map(asGranth)),
    pull("getPramans").then((rows) => rows.map(asPraman)),
  ]);
  const catalog: Catalog = { topics, granths, pramans, syncedAt: Date.now() };
  await replaceCatalog(catalog);
  await setMeta("resourceVersion", RESOURCE_VERSION);
  await setMeta(
    "resourceCounts",
    JSON.stringify({ topics: topics.length, granths: granths.length, pramans: pramans.length }),
  );
  return catalog;
}

export async function rememberExistingImages(paths: string[]): Promise<Record<string, string>> {
  const known = await listLocalFiles();
  const map: Record<string, string> = {};
  for (const row of known) map[row.path] = row.localUri;
  for (const path of paths) {
    if (map[path]) continue;
    const dest = imageCacheUri(path);
    const ready = await fileReady(dest);
    if (!ready.ok) continue;
    map[path] = dest;
    await upsertLocalFile(path, dest, ready.size);
  }
  return map;
}

export function queueImageDownloads(paths: string[], have: Record<string, string>): number {
  let queued = 0;
  for (const path of paths) {
    if (have[path]) continue;
    enqueueDownload({
      id: `img:${path}`,
      kind: "image",
      title: path.split("/").pop() ?? path,
      url: remoteUrl(path),
      dest: imageCacheUri(path),
      sourcePath: path,
    });
    queued += 1;
  }
  return queued;
}

export const DEFAULT_RESOURCE_VERSION = RESOURCE_VERSION;
