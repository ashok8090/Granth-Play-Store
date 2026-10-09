import { unzipSync } from "fflate";
import { getMeta, replaceCatalog, setMeta } from "../database/db";
import type { Catalog, Granth, Praman, ResourcePack, Topic } from "../models/types";
import { DEFAULT_RESOURCE_VERSION } from "./CatalogService";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value);
}

export function compareVersion(left: string, right: string): number {
  const a = left.split(".").map((part) => Number(part) || 0);
  const b = right.split(".").map((part) => Number(part) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

export function parseResourcePackBytes(bytes: Uint8Array): ResourcePack {
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes);
    const entry = Object.entries(files).find(([name]) => name.endsWith(".json") && !name.includes("__MACOSX"));
    const payload = entry?.[1];
    if (!payload) throw new Error("Invalid resource pack");
    text = new TextDecoder().decode(payload);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return parseResourcePack(text);
}

export function parseResourcePack(raw: string): ResourcePack {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error("Invalid resource pack");
  }
  if (!isRecord(body)) throw new Error("Invalid resource pack");
  if (typeof body.resourceVersion !== "string" || !body.resourceVersion.trim()) {
    throw new Error("Missing resourceVersion");
  }
  if (!Array.isArray(body.topics) || !Array.isArray(body.granths) || !Array.isArray(body.pramans)) {
    throw new Error("Resource pack is missing topics, granths, or pramans");
  }
  const topics = body.topics.filter(isRecord).map((row): Topic => ({
    id: text(row, "id"),
    title: text(row, "title"),
    description: text(row, "description"),
    position: text(row, "position"),
    user: text(row, "user"),
    created_at: text(row, "created_at"),
    granth_count: text(row, "granth_count"),
    praman_count: text(row, "praman_count"),
  }));
  const granths = body.granths.filter(isRecord).map((row): Granth => ({
    id: text(row, "id"),
    title: text(row, "title"),
    author: text(row, "author"),
    topic_id: row.topic_id == null ? null : text(row, "topic_id"),
    description: text(row, "description"),
    imagePath: text(row, "imagePath"),
    editorImagePath: text(row, "editorImagePath"),
    position: text(row, "position"),
    user: text(row, "user"),
    created_at: text(row, "created_at"),
    pramanCount: text(row, "pramanCount"),
  }));
  const pramans = body.pramans.filter(isRecord).map((row): Praman => ({
    id: text(row, "id"),
    title: text(row, "title"),
    description: text(row, "description"),
    is_favorate: text(row, "is_favorate"),
    topic_id: text(row, "topic_id"),
    granth_id: text(row, "granth_id"),
    image_path: text(row, "image_path"),
    youtube_url: text(row, "youtube_url"),
    youtube_start: text(row, "youtube_start"),
    youtube_desc: text(row, "youtube_desc"),
    user: text(row, "user"),
    created_at: text(row, "created_at"),
    topic_title: text(row, "topic_title"),
    granth_title: text(row, "granth_title"),
    granth_image: text(row, "granth_image"),
    editorImagePath: text(row, "editorImagePath"),
    granth_auther: text(row, "granth_auther"),
  }));
  if (!topics.length && !granths.length && !pramans.length) throw new Error("Resource pack is empty");
  return { resourceVersion: body.resourceVersion.trim(), topics, granths, pramans };
}

export async function currentResourceVersion(): Promise<string> {
  return (await getMeta("resourceVersion")) ?? DEFAULT_RESOURCE_VERSION;
}

export async function importResourcePack(pack: ResourcePack, force = false): Promise<Catalog> {
  const current = await currentResourceVersion();
  if (!force && compareVersion(pack.resourceVersion, current) < 0) {
    throw new Error(`Pack ${pack.resourceVersion} is older than ${current}`);
  }
  const catalog: Catalog = {
    topics: pack.topics,
    granths: pack.granths,
    pramans: pack.pramans,
    syncedAt: Date.now(),
  };
  await replaceCatalog(catalog);
  await setMeta("resourceVersion", pack.resourceVersion);
  await setMeta(
    "resourceCounts",
    JSON.stringify({
      topics: pack.topics.length,
      granths: pack.granths.length,
      pramans: pack.pramans.length,
    }),
  );
  return catalog;
}
