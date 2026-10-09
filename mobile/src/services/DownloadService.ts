import * as FileSystem from "expo-file-system/legacy";
import { saveDownload } from "../database/db";
import type { DownloadJob, JobStatus } from "../models/types";
import { fileReady, looksLikeImage } from "./StorageService";

type Listener = () => void;

const jobs = new Map<string, DownloadJob>();
const handles = new Map<string, FileSystem.DownloadResumable>();
const listeners = new Set<Listener>();
const waiters = new Map<string, Array<(job: DownloadJob) => void>>();
let running = 0;
let pumping = false;
let emitTimer: ReturnType<typeof setTimeout> | null = null;
const MAX = 2;

function emit(immediate = false): void {
  if (emitTimer) clearTimeout(emitTimer);
  if (!immediate) {
    emitTimer = setTimeout(() => {
      emitTimer = null;
      for (const listener of listeners) listener();
    }, 280);
    return;
  }
  emitTimer = null;
  for (const listener of listeners) listener();
}

function finishWaiters(job: DownloadJob): void {
  const pending = waiters.get(job.id) ?? [];
  waiters.delete(job.id);
  for (const resolve of pending) resolve(job);
}

export function subscribeDownloads(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshotDownloads(): DownloadJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function hydrateDownloads(rows: DownloadJob[]): void {
  for (const row of rows) {
    if (!jobs.has(row.id)) jobs.set(row.id, row);
  }
  emit(true);
}

async function persist(job: DownloadJob): Promise<void> {
  try {
    await saveDownload(job);
  } catch {
    /* a failed log must not crash the queue */
  }
}

function setStatus(job: DownloadJob, status: JobStatus, extra?: Partial<DownloadJob>): void {
  Object.assign(job, extra, { status });
  void persist(job);
  emit(true);
  if (status === "done" || status === "failed" || status === "cancelled" || status === "paused") finishWaiters(job);
}

async function runJob(job: DownloadJob): Promise<void> {
  const ready = await fileReady(job.dest);
  if (ready.ok && (job.kind !== "image" || (await looksLikeImage(job.dest)))) {
    setStatus(job, "done", { progress: 1, bytes: ready.size, error: null, resumeData: null });
    return;
  }
  setStatus(job, "running", { error: null });
  const parent = job.dest.slice(0, job.dest.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  const resumable = FileSystem.createDownloadResumable(
    job.url,
    job.dest,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      job.bytes = progress.totalBytesWritten;
      job.progress = total > 0 ? Math.min(0.99, progress.totalBytesWritten / total) : 0;
      emit(false);
    },
    job.resumeData ?? undefined,
  );
  handles.set(job.id, resumable);
  try {
    const result = await resumable.downloadAsync();
    if (job.status === "paused" || job.status === "cancelled") return;
    if (!result) throw new Error("Download cancelled");
    const info = await fileReady(job.dest);
    if (!info.ok) throw new Error("Downloaded file is empty");
    if (job.kind === "image" && !(await looksLikeImage(job.dest))) {
      await FileSystem.deleteAsync(job.dest, { idempotent: true });
      throw new Error("File integrity check failed");
    }
    setStatus(job, "done", { progress: 1, bytes: info.size, error: null, resumeData: null });
  } catch (error) {
    if (job.status === "paused" || job.status === "cancelled") return;
    setStatus(job, "failed", { error: error instanceof Error ? error.message : "Download failed" });
  } finally {
    handles.delete(job.id);
  }
}

function pump(): void {
  if (pumping) return;
  pumping = true;
  try {
    const queued = [...jobs.values()]
      .filter((job) => job.status === "queued")
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const job of queued) {
      if (running >= MAX) break;
      running += 1;
      void runJob(job).finally(() => {
        running -= 1;
        pump();
      });
    }
  } finally {
    pumping = false;
  }
}

export function enqueueDownload(input: {
  id: string;
  kind: DownloadJob["kind"];
  title: string;
  url: string;
  dest: string;
  sourcePath?: string;
  priority?: boolean;
}): DownloadJob {
  const existing = jobs.get(input.id);
  if (existing && (existing.status === "queued" || existing.status === "running")) {
    if (input.priority && existing.status === "queued") existing.createdAt = 0;
    return existing;
  }
  if (existing && existing.status === "paused" && !input.priority) return existing;
  const job: DownloadJob = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    url: input.url,
    dest: input.dest,
    status: "queued",
    progress: existing?.status === "paused" ? existing.progress : 0,
    bytes: existing?.bytes ?? 0,
    error: null,
    createdAt: input.priority ? 0 : Date.now(),
    resumeData: existing?.status === "failed" ? null : (existing?.resumeData ?? null),
    sourcePath: input.sourcePath ?? existing?.sourcePath ?? "",
  };
  jobs.set(job.id, job);
  void persist(job);
  emit(true);
  pump();
  return job;
}

export function waitForDownload(id: string): Promise<DownloadJob> {
  const job = jobs.get(id);
  if (job && (job.status === "done" || job.status === "failed" || job.status === "cancelled")) return Promise.resolve(job);
  return new Promise((resolve) => {
    const list = waiters.get(id) ?? [];
    list.push(resolve);
    waiters.set(id, list);
  });
}

export async function pauseDownload(id: string): Promise<void> {
  const job = jobs.get(id);
  const handle = handles.get(id);
  if (!job) return;
  if (job.status === "queued") {
    setStatus(job, "paused");
    return;
  }
  if (!handle || job.status !== "running") return;
  job.status = "paused";
  try {
    const state = await handle.pauseAsync();
    job.resumeData = state.resumeData ?? null;
    setStatus(job, "paused", { resumeData: job.resumeData });
  } catch (error) {
    setStatus(job, "failed", { error: error instanceof Error ? error.message : "Pause failed" });
  }
}

export function resumeDownload(id: string): void {
  const job = jobs.get(id);
  if (!job || (job.status !== "paused" && job.status !== "failed")) return;
  setStatus(job, "queued", { error: null });
  pump();
}

export async function cancelDownload(id: string): Promise<void> {
  const job = jobs.get(id);
  const handle = handles.get(id);
  if (!job) return;
  job.status = "cancelled";
  try {
    await handle?.cancelAsync();
  } catch {
    /* already stopped */
  }
  try {
    await FileSystem.deleteAsync(job.dest, { idempotent: true });
  } catch {
    /* partial file may already be gone */
  }
  setStatus(job, "cancelled", { progress: 0, error: null });
}

export function retryDownload(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.resumeData = null;
  setStatus(job, "queued", { error: null, progress: 0 });
  pump();
}

export async function pauseAll(): Promise<void> {
  const ids = [...jobs.values()].filter((job) => job.status === "running" || job.status === "queued").map((job) => job.id);
  await Promise.all(ids.map((id) => pauseDownload(id)));
}

export function resumeAll(): void {
  for (const job of jobs.values()) {
    if (job.status === "paused" || job.status === "failed") resumeDownload(job.id);
  }
}
