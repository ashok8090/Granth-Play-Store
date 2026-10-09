import * as SQLite from "expo-sqlite";
import type { Catalog, DownloadJob, GalleryFolder, GalleryItem, Granth, Praman, Topic } from "../models/types";

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function database(): Promise<SQLite.SQLiteDatabase> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync("granth.db");
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY, title TEXT, description TEXT, position TEXT,
        user TEXT, created_at TEXT, granth_count TEXT, praman_count TEXT
      );
      CREATE TABLE IF NOT EXISTS granths (
        id TEXT PRIMARY KEY, title TEXT, author TEXT, topic_id TEXT, description TEXT,
        imagePath TEXT, editorImagePath TEXT, position TEXT, user TEXT, created_at TEXT, pramanCount TEXT
      );
      CREATE TABLE IF NOT EXISTS pramans (
        id TEXT PRIMARY KEY, title TEXT, description TEXT, is_favorate TEXT, topic_id TEXT, granth_id TEXT,
        image_path TEXT, youtube_url TEXT, youtube_start TEXT, youtube_desc TEXT, user TEXT, created_at TEXT,
        topic_title TEXT, granth_title TEXT, granth_image TEXT, editorImagePath TEXT, granth_auther TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_praman_topic ON pramans(topic_id);
      CREATE INDEX IF NOT EXISTS idx_praman_granth ON pramans(granth_id);
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY, localUri TEXT NOT NULL, bytes INTEGER NOT NULL, updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gallery (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT, text TEXT, topic TEXT, granth TEXT,
        folderId TEXT, createdAt INTEGER, size INTEGER, fileName TEXT, localUri TEXT, sourceId TEXT
      );
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY, kind TEXT, title TEXT, url TEXT, dest TEXT, status TEXT,
        progress REAL, bytes INTEGER, error TEXT, createdAt INTEGER, resumeData TEXT, sourcePath TEXT
      );
    `);
    return db;
  })();
  return opening;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
}

export async function readCatalog(): Promise<Catalog | null> {
  const db = await database();
  const topics = await db.getAllAsync<Topic>("SELECT * FROM topics");
  if (!topics.length) return null;
  const granths = await db.getAllAsync<Granth>("SELECT * FROM granths");
  const pramans = await db.getAllAsync<Praman>("SELECT * FROM pramans");
  const synced = await getMeta("syncedAt");
  return { topics, granths, pramans, syncedAt: Number(synced) || 0 };
}

export async function replaceCatalog(catalog: Catalog): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM topics");
    await db.runAsync("DELETE FROM granths");
    await db.runAsync("DELETE FROM pramans");
    for (const row of catalog.topics) {
      await db.runAsync(
        `INSERT INTO topics (id, title, description, position, user, created_at, granth_count, praman_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.title, row.description, row.position, row.user, row.created_at, row.granth_count, row.praman_count,
      );
    }
    for (const row of catalog.granths) {
      await db.runAsync(
        `INSERT INTO granths (id, title, author, topic_id, description, imagePath, editorImagePath, position, user, created_at, pramanCount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.title, row.author, row.topic_id, row.description, row.imagePath, row.editorImagePath,
        row.position, row.user, row.created_at, row.pramanCount,
      );
    }
    for (const row of catalog.pramans) {
      await db.runAsync(
        `INSERT INTO pramans (
          id, title, description, is_favorate, topic_id, granth_id, image_path, youtube_url, youtube_start,
          youtube_desc, user, created_at, topic_title, granth_title, granth_image, editorImagePath, granth_auther
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.title, row.description, row.is_favorate, row.topic_id, row.granth_id, row.image_path,
        row.youtube_url, row.youtube_start, row.youtube_desc, row.user, row.created_at, row.topic_title,
        row.granth_title, row.granth_image, row.editorImagePath, row.granth_auther,
      );
    }
    await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('syncedAt', ?)", String(catalog.syncedAt));
  });
}

export async function listLocalFiles(): Promise<Array<{ path: string; localUri: string; bytes: number }>> {
  const db = await database();
  return db.getAllAsync("SELECT path, localUri, bytes FROM files");
}

export async function upsertLocalFile(path: string, localUri: string, bytes: number): Promise<void> {
  const db = await database();
  await db.runAsync(
    "INSERT OR REPLACE INTO files (path, localUri, bytes, updatedAt) VALUES (?, ?, ?, ?)",
    path, localUri, bytes, Date.now(),
  );
}

export async function listFolders(): Promise<GalleryFolder[]> {
  const db = await database();
  return db.getAllAsync("SELECT id, name, createdAt FROM folders ORDER BY name COLLATE NOCASE");
}

export async function saveFolder(folder: GalleryFolder): Promise<void> {
  const db = await database();
  await db.runAsync(
    "INSERT OR REPLACE INTO folders (id, name, createdAt) VALUES (?, ?, ?)",
    folder.id, folder.name, folder.createdAt,
  );
}

export async function removeFolder(id: string): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE gallery SET folderId = '' WHERE folderId = ?", id);
    await db.runAsync("DELETE FROM folders WHERE id = ?", id);
  });
}

export async function listGallery(): Promise<GalleryItem[]> {
  const db = await database();
  return db.getAllAsync("SELECT * FROM gallery ORDER BY createdAt DESC");
}

export async function saveGalleryItem(item: GalleryItem): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT OR REPLACE INTO gallery
      (id, kind, title, text, topic, granth, folderId, createdAt, size, fileName, localUri, sourceId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id, item.kind, item.title, item.text, item.topic, item.granth, item.folderId,
    item.createdAt, item.size, item.fileName, item.localUri, item.sourceId,
  );
}

export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  const db = await database();
  return (await db.getFirstAsync<GalleryItem>("SELECT * FROM gallery WHERE id = ?", id)) ?? null;
}

export async function removeGalleryItems(ids: string[]): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const id of ids) await db.runAsync("DELETE FROM gallery WHERE id = ?", id);
  });
}

export async function moveGalleryItems(ids: string[], folderId: string): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const id of ids) await db.runAsync("UPDATE gallery SET folderId = ? WHERE id = ?", folderId, id);
  });
}

export async function saveDownload(job: DownloadJob): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT OR REPLACE INTO downloads
      (id, kind, title, url, dest, status, progress, bytes, error, createdAt, resumeData, sourcePath)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    job.id, job.kind, job.title, job.url, job.dest, job.status, job.progress, job.bytes,
    job.error, job.createdAt, job.resumeData, job.sourcePath,
  );
}

export async function listDownloads(): Promise<DownloadJob[]> {
  const db = await database();
  const rows = await db.getAllAsync<DownloadJob>("SELECT * FROM downloads ORDER BY createdAt DESC");
  return rows.map((row) => ({
    ...row,
    progress: Number(row.progress) || 0,
    bytes: Number(row.bytes) || 0,
    createdAt: Number(row.createdAt) || 0,
    error: row.error ?? null,
    resumeData: row.resumeData ?? null,
    sourcePath: row.sourcePath ?? "",
    status: row.status === "running" ? "paused" : row.status,
  }));
}
