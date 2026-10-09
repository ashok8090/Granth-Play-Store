import { writeImage } from "./db";
import { mergeCatalog } from "./admin-merge";
import {
  emptyDraft,
  type ActivityLog,
  type AdminEvent,
  type AdminUser,
  type Draft,
  type EntityKind,
  type FeedbackItem,
  type FeedbackStatus,
  type Priority,
  type RequestType,
  type Role,
  type SessionUser,
} from "./admin-model";
import { AdminError, assertCanAssign, assertContent, assertFeedback, canContent } from "./admin-roles";
import type { Catalog, Granth, Praman, Topic } from "./types";

const DB_NAME = "granth-admin";
const SESSION_KEY = "granth-admin-token";
const DEVICE_KEY = "granth-device";
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_EVENTS = 4000;

type UserRow = AdminUser & { kind: "user"; salt: string; hash: string };
type SessionRow = { kind: "session"; id: string; userId: string; expiresAt: number };
type Doc = UserRow | SessionRow | (Draft & { kind: "draft" }) | (FeedbackItem & { kind: "feedback" }) | (AdminEvent & { kind: "event" }) | (ActivityLog & { kind: "log" }) | { kind: "meta"; id: string; value: string };

let dbPromise: Promise<IDBDatabase> | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export function useAdminRevision(): number {
  return revision;
}

export function subscribeAdmin(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function adminRevision(): number {
  return revision;
}

function bump() {
  revision += 1;
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("granth-admin-refresh"));
}

function hasDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!hasDb()) return Promise.reject(new AdminError("NO_STORE", "यह ब्राउज़र एडमिन संग्रह नहीं खोल पाया।"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("docs")) {
          const store = db.createObjectStore("docs", { keyPath: "id" });
          store.createIndex("kind", "kind");
        }
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("idb"));
    });
  }
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function putDoc(doc: Doc): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("docs", "readwrite");
  tx.objectStore("docs").put(doc);
  await txDone(tx);
}

async function getDoc<T extends Doc>(id: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction("docs", "readonly");
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = tx.objectStore("docs").get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
  return value ?? null;
}

async function deleteDoc(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("docs", "readwrite");
  tx.objectStore("docs").delete(id);
  await txDone(tx);
}

async function docsOf(kind: Doc["kind"]): Promise<Doc[]> {
  const db = await openDb();
  const tx = db.transaction("docs", "readonly");
  const rows = await new Promise<Doc[]>((resolve, reject) => {
    const request = tx.objectStore("docs").index("kind").getAll(kind);
    request.onsuccess = () => resolve((request.result as Doc[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  return rows;
}

async function putFile(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("files", "readwrite");
  tx.objectStore("files").put(blob, key);
  await txDone(tx);
}

export async function readAdminFile(key: string): Promise<Blob | null> {
  if (!hasDb() || !key) return null;
  const db = await openDb();
  const tx = db.transaction("files", "readonly");
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = tx.objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  return blob ?? null;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex) as BufferSource, iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(bits);
}

function newId(prefix: string): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}${raw}`;
}

function dayStamp(at = Date.now()): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const next = newId("dev");
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return "device";
  }
}

function tokenOf(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberToken(token: string) {
  sessionStorage.setItem(SESSION_KEY, token);
}

export async function needsBootstrap(): Promise<boolean> {
  if (!hasDb()) return true;
  const users = await docsOf("user");
  return users.length === 0;
}

async function writeLog(user: AdminUser, action: string, entity: string, entityId: string, meta = ""): Promise<void> {
  const row: ActivityLog & { kind: "log" } = {
    kind: "log",
    id: newId("log"),
    userId: user.id,
    userName: user.name,
    action,
    entity,
    entityId,
    meta,
    at: Date.now(),
  };
  await putDoc(row);
}

async function sessionUser(token = tokenOf()): Promise<SessionUser | null> {
  if (!token || !hasDb()) return null;
  const row = await getDoc<SessionRow>(token);
  if (!row || row.kind !== "session" || row.expiresAt < Date.now()) {
    if (row) await deleteDoc(token);
    return null;
  }
  const user = await getDoc<UserRow>(row.userId);
  if (!user || user.kind !== "user" || !user.active || user.role === "USER") return null;
  const { salt: _salt, hash: _hash, kind: _kind, ...safe } = user;
  return { token, user: safe, expiresAt: row.expiresAt };
}

export async function currentSession(): Promise<SessionUser | null> {
  return sessionUser();
}

async function requireUser(): Promise<SessionUser> {
  const session = await sessionUser();
  if (!session) throw new AdminError("AUTH", "फिर से लॉग इन करें।");
  return session;
}

function checkPassword(password: string) {
  if (password.length < 8 || password.length > 72) {
    throw new AdminError("VALIDATION_ERROR", "पासवर्ड 8 से 72 अक्षर का होना चाहिए।");
  }
}

function checkEmail(email: string): string {
  const next = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new AdminError("VALIDATION_ERROR", "ईमेल सही नहीं है।");
  return next;
}

async function lockState(email: string): Promise<{ fails: number; until: number }> {
  const row = await getDoc<{ kind: "meta"; id: string; value: string }>(`lock:${email}`);
  if (!row) return { fails: 0, until: 0 };
  try {
    return JSON.parse(row.value) as { fails: number; until: number };
  } catch {
    return { fails: 0, until: 0 };
  }
}

async function setLock(email: string, fails: number, until: number) {
  await putDoc({ kind: "meta", id: `lock:${email}`, value: JSON.stringify({ fails, until }) });
}

export async function bootstrapAdmin(input: { name: string; email: string; password: string }): Promise<SessionUser> {
  if (!(await needsBootstrap())) throw new AdminError("FORBIDDEN", "पहला एडमिन पहले से बना है।");
  checkPassword(input.password);
  const email = checkEmail(input.email);
  const name = input.name.trim();
  if (name.length < 2) throw new AdminError("VALIDATION_ERROR", "नाम लिखें।");
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const user: UserRow = {
    kind: "user",
    id: newId("usr"),
    name,
    email,
    role: "SUPER_ADMIN",
    active: true,
    createdAt: Date.now(),
    salt,
    hash: await hashPassword(input.password, salt),
  };
  await putDoc(user);
  const token = newId("tok");
  const expiresAt = Date.now() + SESSION_MS;
  await putDoc({ kind: "session", id: token, userId: user.id, expiresAt });
  rememberToken(token);
  const { salt: _s, hash: _h, kind: _k, ...safe } = user;
  await writeLog(safe, "ADMIN_CREATED_USER", "user", user.id, "bootstrap");
  bump();
  return { token, user: safe, expiresAt };
}

export async function loginAdmin(emailRaw: string, password: string): Promise<SessionUser> {
  const email = checkEmail(emailRaw);
  const lock = await lockState(email);
  if (lock.until > Date.now()) throw new AdminError("RATE_LIMIT", "बहुत अधिक कोशिश। कुछ देर बाद फिर कोशिश करें।");
  const users = (await docsOf("user")) as UserRow[];
  const user = users.find((row) => row.email === email && row.active);
  const hash = user ? await hashPassword(password, user.salt) : "";
  if (!user || hash !== user.hash || user.role === "USER") {
    const fails = lock.fails + 1;
    await setLock(email, fails, fails >= 8 ? Date.now() + 5 * 60 * 1000 : 0);
    throw new AdminError("AUTH", "ईमेल या पासवर्ड गलत है।");
  }
  await setLock(email, 0, 0);
  const token = newId("tok");
  const expiresAt = Date.now() + SESSION_MS;
  await putDoc({ kind: "session", id: token, userId: user.id, expiresAt });
  rememberToken(token);
  const { salt: _s, hash: _h, kind: _k, ...safe } = user;
  await writeLog(safe, "ADMIN_LOGIN", "session", user.id);
  bump();
  return { token, user: safe, expiresAt };
}

export async function logoutAdmin(): Promise<void> {
  const token = tokenOf();
  if (token) await deleteDoc(token).catch(() => undefined);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  bump();
}

export async function listUsers(): Promise<AdminUser[]> {
  const session = await requireUser();
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
    throw new AdminError("FORBIDDEN", "सदस्य सूची नहीं खुल सकती।");
  }
  const users = (await docsOf("user")) as UserRow[];
  return users
    .map(({ salt: _s, hash: _h, kind: _k, ...safe }) => safe)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveUser(input: { id?: string; name: string; email: string; password?: string; role: Role; active: boolean }): Promise<void> {
  const session = await requireUser();
  const email = checkEmail(input.email);
  const name = input.name.trim();
  if (name.length < 2) throw new AdminError("VALIDATION_ERROR", "नाम लिखें।");
  const users = (await docsOf("user")) as UserRow[];
  if (input.id) {
    const existing = users.find((user) => user.id === input.id);
    if (!existing) throw new AdminError("NOT_FOUND", "सदस्य नहीं मिला।");
    if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
      throw new AdminError("FORBIDDEN", "सुपर एडमिन को बदलने की अनुमति नहीं है।");
    }
    if (existing.id === session.user.id && input.role !== existing.role) {
      throw new AdminError("FORBIDDEN", "अपनी भूमिका खुद नहीं बदल सकते।");
    }
    if (input.role !== existing.role) assertCanAssign(session.user.role, input.role);
    if (existing.role === "SUPER_ADMIN" && !input.active) {
      const supers = users.filter((user) => user.role === "SUPER_ADMIN" && user.active);
      if (supers.length < 2) throw new AdminError("FORBIDDEN", "आखिरी सुपर एडमिन बंद नहीं हो सकता।");
    }
    if (users.some((user) => user.email === email && user.id !== existing.id)) {
      throw new AdminError("VALIDATION_ERROR", "यह ईमेल पहले से है।");
    }
    const next: UserRow = { ...existing, name, email, role: input.role, active: input.active };
    if (input.password) {
      checkPassword(input.password);
      next.hash = await hashPassword(input.password, existing.salt);
    }
    await putDoc(next);
    await writeLog(session.user, input.role !== existing.role ? "ADMIN_CHANGED_ROLE" : "ADMIN_UPDATED_USER", "user", existing.id, input.role);
  } else {
    assertCanAssign(session.user.role, input.role);
    if (!input.password) throw new AdminError("VALIDATION_ERROR", "नए सदस्य का पासवर्ड लिखें।");
    checkPassword(input.password);
    if (users.some((user) => user.email === email)) throw new AdminError("VALIDATION_ERROR", "यह ईमेल पहले से है।");
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const row: UserRow = {
      kind: "user",
      id: newId("usr"),
      name,
      email,
      role: input.role,
      active: input.active,
      createdAt: Date.now(),
      salt,
      hash: await hashPassword(input.password, salt),
    };
    await putDoc(row);
    await writeLog(session.user, "ADMIN_CREATED_USER", "user", row.id, input.role);
  }
  bump();
}

export async function listDrafts(): Promise<Draft[]> {
  if (!hasDb()) return [];
  const rows = await docsOf("draft");
  return rows.filter((row): row is Draft & { kind: "draft" } => row.kind === "draft").map(({ kind: _k, ...draft }) => draft);
}

export async function saveDraft(draft: Draft, serverSignature = ""): Promise<Draft> {
  const session = await requireUser();
  assertContent(session.user.role);
  if (!draft.title.trim() && draft.entity !== "folder") throw new AdminError("VALIDATION_ERROR", "शीर्षक लिखें।");
  if (draft.entity === "folder" && !draft.name.trim()) throw new AdminError("VALIDATION_ERROR", "फ़ोल्डर का नाम लिखें।");
  if (draft.origin === "server" && draft.signature && serverSignature && draft.signature !== serverSignature && !draft.conflict) {
    const blocked = { ...draft, conflict: true };
    await putDoc({ ...blocked, kind: "draft" });
    bump();
    throw new AdminError("CONFLICT", "सर्वर पर यह सामग्री बदल चुकी है। अपनी प्रति रखें या सर्वर वाली वापस लें।");
  }
  const previous = await getDoc<Draft & { kind: "draft" }>(draft.id);
  const created = !previous;
  const next: Draft = {
    ...draft,
    title: draft.title.trim(),
    name: draft.name.trim(),
    touched: true,
    conflict: false,
    signature: serverSignature || draft.signature,
    updatedAt: Date.now(),
    version: (previous?.version ?? draft.version) + (draft.status === "published" ? 1 : 0),
  };
  await putDoc({ ...next, kind: "draft" });
  const action = created ? `ADMIN_CREATED_${draft.entity.toUpperCase()}` : `ADMIN_UPDATED_${draft.entity.toUpperCase()}`;
  await writeLog(session.user, next.status === "published" ? "ADMIN_PUBLISHED_CONTENT" : action, draft.entity, draft.id, next.title || next.name);
  if (next.status === "published") await bumpContentVersion();
  bump();
  return next;
}

export async function discardDraft(id: string): Promise<void> {
  const session = await requireUser();
  assertContent(session.user.role);
  await deleteDoc(id);
  await writeLog(session.user, "ADMIN_DISCARDED_DRAFT", "draft", id);
  bump();
}

export async function softDeleteDraft(id: string): Promise<void> {
  const session = await requireUser();
  assertContent(session.user.role);
  const row = await getDoc<Draft & { kind: "draft" }>(id);
  if (!row || row.kind !== "draft") throw new AdminError("NOT_FOUND", "रिकॉर्ड नहीं मिला।");
  if (row.entity === "folder") {
    const drafts = await listDrafts();
    const parent = row.parentId;
    for (const child of drafts) {
      if (child.parentId === id || child.folderId === id) {
        await putDoc({
          ...child,
          kind: "draft",
          parentId: child.parentId === id ? parent : child.parentId,
          folderId: child.folderId === id ? parent : child.folderId,
          touched: true,
          updatedAt: Date.now(),
        });
      }
    }
  }
  const next = { ...row, deletedAt: Date.now(), status: "unpublished" as const, touched: true, updatedAt: Date.now() };
  await putDoc(next);
  await writeLog(session.user, `ADMIN_DELETED_${row.entity.toUpperCase()}`, row.entity, id, row.title || row.name);
  await bumpContentVersion();
  bump();
}

export async function restoreDraft(id: string): Promise<void> {
  const session = await requireUser();
  assertContent(session.user.role);
  const row = await getDoc<Draft & { kind: "draft" }>(id);
  if (!row) throw new AdminError("NOT_FOUND", "रिकॉर्ड नहीं मिला।");
  await putDoc({ ...row, deletedAt: null, status: "draft", touched: true, updatedAt: Date.now() });
  await writeLog(session.user, "ADMIN_RESTORED_CONTENT", row.entity, id);
  bump();
}

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function storeOriginal(file: File, slot: "image" | "pdf" | "attachment"): Promise<{ path: string; mime: string; size: number; width: number; height: number }> {
  const mime = file.type || "application/octet-stream";
  const ext = ALLOWED_MIME[mime];
  if (!ext) throw new AdminError("VALIDATION_ERROR", "सिर्फ़ JPEG, PNG, WEBP, GIF या PDF।");
  if (slot === "pdf" && mime !== "application/pdf") throw new AdminError("VALIDATION_ERROR", "PDF फ़ाइल चुनें।");
  if (slot !== "pdf" && mime === "application/pdf" && slot !== "attachment") {
    throw new AdminError("VALIDATION_ERROR", "यहाँ चित्र चाहिए।");
  }
  const limit = mime === "application/pdf" ? 40 * 1024 * 1024 : slot === "attachment" ? 8 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size <= 0 || file.size > limit) throw new AdminError("VALIDATION_ERROR", "फ़ाइल खाली है या आकार सीमा से बड़ी है।");
  const path = `uploads/admin-${newId("f")}.${ext}`;
  const blob = file.slice(0, file.size, mime);
  await putFile(path, blob);
  if (mime.startsWith("image/")) await writeImage(path, blob);
  let width = 0;
  let height = 0;
  if (mime.startsWith("image/") && typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  }
  return { path, mime, size: file.size, width, height };
}

export async function submitFeedback(input: {
  mode: "general" | "request";
  requestType?: RequestType | "";
  name: string;
  mobile: string;
  description: string;
  granthId?: string;
  topicId?: string;
  pramanId?: string;
  file?: File | null;
}): Promise<void> {
  const name = input.name.trim();
  const mobile = input.mobile.replace(/[^\d]/g, "");
  const description = input.description.trim();
  if (name.length < 2) throw new AdminError("VALIDATION_ERROR", "नाम लिखें।");
  if (mobile.length < 10 || mobile.length > 15) throw new AdminError("VALIDATION_ERROR", "मोबाइल नंबर 10 से 15 अंक का होना चाहिए।");
  if (description.length < 4) throw new AdminError("VALIDATION_ERROR", "विवरण लिखें।");
  let attachmentName = "";
  let attachmentMime = "";
  let attachmentSize = 0;
  const id = newId("fb");
  if (input.file && input.file.size > 0) {
    const stored = await storeOriginal(input.file, "attachment");
    attachmentName = input.file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80);
    attachmentMime = stored.mime;
    attachmentSize = stored.size;
    const blob = await readAdminFile(stored.path);
    if (blob) await putFile(`att:${id}`, blob);
  }
  const row: FeedbackItem & { kind: "feedback" } = {
    kind: "feedback",
    id,
    mode: input.mode,
    requestType: input.mode === "request" ? input.requestType || "other" : "",
    name,
    mobile,
    description,
    granthId: input.granthId || "",
    topicId: input.topicId || "",
    pramanId: input.pramanId || "",
    status: "pending",
    priority: "normal",
    assigneeId: "",
    note: "",
    attachmentName,
    attachmentMime,
    attachmentSize,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await putDoc(row);
  await recordEvent(input.mode === "request" ? "request" : "feedback", id, input.requestType || "");
  bump();
}

export async function listFeedback(): Promise<FeedbackItem[]> {
  const session = await requireUser();
  if (!canContent(session.user.role)) throw new AdminError("FORBIDDEN", "पत्र नहीं खुल सकते।");
  const rows = (await docsOf("feedback")) as Array<FeedbackItem & { kind: "feedback" }>;
  return rows.map(({ kind: _k, ...item }) => item).sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateFeedback(id: string, patch: { status?: FeedbackStatus; priority?: Priority; note?: string; assigneeId?: string }): Promise<void> {
  const session = await requireUser();
  assertFeedback(session.user.role);
  const row = await getDoc<FeedbackItem & { kind: "feedback" }>(id);
  if (!row || row.kind !== "feedback") throw new AdminError("NOT_FOUND", "पत्र नहीं मिला।");
  const next = {
    ...row,
    status: patch.status ?? row.status,
    priority: patch.priority ?? row.priority,
    note: patch.note ?? row.note,
    assigneeId: patch.assigneeId ?? row.assigneeId,
    updatedAt: Date.now(),
  };
  await putDoc(next);
  const action =
    next.status === "approved" ? "ADMIN_APPROVED_REQUEST" : next.status === "rejected" ? "ADMIN_REJECTED_REQUEST" : "ADMIN_UPDATED_FEEDBACK";
  await writeLog(session.user, action, "feedback", id, next.status);
  bump();
}

export async function recordEvent(type: string, entityId = "", label = ""): Promise<void> {
  if (!hasDb()) return;
  const allowed = new Set([
    "app_open",
    "granth_open",
    "topic_open",
    "praman_open",
    "pdf_open",
    "pdf_download",
    "praman_download",
    "search",
    "search_empty",
    "sync",
    "feedback",
    "request",
  ]);
  if (!allowed.has(type)) return;
  const row: AdminEvent & { kind: "event" } = {
    kind: "event",
    id: newId("ev"),
    type,
    entityId: entityId.slice(0, 80),
    label: label.slice(0, 160),
    device: deviceId(),
    at: Date.now(),
    day: dayStamp(),
  };
  await putDoc(row);
  const events = (await docsOf("event")) as Array<AdminEvent & { kind: "event" }>;
  if (events.length > MAX_EVENTS) {
    const extra = events.sort((a, b) => a.at - b.at).slice(0, events.length - MAX_EVENTS);
    const db = await openDb();
    const tx = db.transaction("docs", "readwrite");
    for (const item of extra) tx.objectStore("docs").delete(item.id);
    await txDone(tx);
  }
}

export async function listEvents(): Promise<AdminEvent[]> {
  if (!hasDb()) return [];
  const rows = (await docsOf("event")) as Array<AdminEvent & { kind: "event" }>;
  return rows.map(({ kind: _k, ...event }) => event);
}

export async function listLogs(): Promise<ActivityLog[]> {
  const session = await requireUser();
  if (session.user.role === "EDITOR") throw new AdminError("FORBIDDEN", "गतिविधि लॉग एडमिन के लिए है।");
  const rows = (await docsOf("log")) as Array<ActivityLog & { kind: "log" }>;
  return rows.map(({ kind: _k, ...log }) => log).sort((a, b) => b.at - a.at).slice(0, 300);
}

async function bumpContentVersion(): Promise<number> {
  const current = await getDoc<{ kind: "meta"; id: string; value: string }>("meta:version");
  const next = Number(current?.value ?? "0") + 1;
  await putDoc({ kind: "meta", id: "meta:version", value: String(next) });
  return next;
}

export async function contentVersion(): Promise<number> {
  if (!hasDb()) return 0;
  const current = await getDoc<{ kind: "meta"; id: string; value: string }>("meta:version");
  return Number(current?.value ?? "0");
}

export async function applyPublishedOverlay(catalog: Catalog): Promise<Catalog> {
  if (!hasDb()) return catalog;
  try {
    const drafts = await listDrafts();
    return mergeCatalog(catalog, drafts);
  } catch {
    return catalog;
  }
}

export function granthSignature(granth: Granth): string {
  return [granth.title, granth.author, granth.description, granth.imagePath, granth.editorImagePath, granth.granthURL ?? "", granth.position, granth.topic_id ?? ""].join("\u0001");
}

export function topicSignature(topic: Topic): string {
  return [topic.title, topic.description, topic.position].join("\u0001");
}

export function pramanSignature(praman: Praman): string {
  return [praman.title, praman.description, praman.image_path, praman.topic_id, praman.granth_id, praman.youtube_url, praman.youtube_start, praman.youtube_desc].join("\u0001");
}

export function draftFromGranth(granth: Granth): Draft {
  const draft = emptyDraft("granth", granth.id, "server");
  draft.title = granth.title;
  draft.author = granth.author;
  draft.description = granth.description;
  draft.imagePath = granth.imagePath;
  draft.editorImagePath = granth.editorImagePath;
  draft.granthURL = granth.granthURL ?? "";
  draft.position = granth.position;
  draft.topicId = granth.topic_id ?? "";
  draft.signature = granthSignature(granth);
  draft.status = "published";
  return draft;
}

export function draftFromTopic(topic: Topic): Draft {
  const draft = emptyDraft("topic", topic.id, "server");
  draft.title = topic.title;
  draft.description = topic.description;
  draft.position = topic.position;
  draft.signature = topicSignature(topic);
  draft.status = "published";
  return draft;
}

export function draftFromPraman(praman: Praman): Draft {
  const draft = emptyDraft("praman", praman.id, "server");
  draft.title = praman.title;
  draft.description = praman.description;
  draft.imagePath = praman.image_path;
  draft.topicId = praman.topic_id;
  draft.granthId = praman.granth_id;
  draft.youtubeUrl = praman.youtube_url;
  draft.youtubeStart = praman.youtube_start;
  draft.youtubeDesc = praman.youtube_desc;
  draft.signature = pramanSignature(praman);
  draft.status = "published";
  return draft;
}

export function newLocalDraft(entity: EntityKind): Draft {
  return emptyDraft(entity, newId("local"), "local");
}

export type ManifestRow = { id: string; version: number; updatedAt: number; size: number; mime: string };

export async function contentManifest(): Promise<ManifestRow[]> {
  const drafts = await listDrafts();
  return drafts
    .filter((draft) => draft.touched && (draft.imagePath.startsWith("uploads/admin-") || draft.pdfName))
    .map((draft) => ({
      id: draft.id,
      version: draft.version,
      updatedAt: draft.updatedAt,
      size: draft.imageSize || draft.pdfSize,
      mime: draft.imageMime || draft.pdfMime,
    }));
}
