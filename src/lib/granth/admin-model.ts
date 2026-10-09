export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "USER";

export type PublishStatus = "draft" | "published" | "unpublished";

export type EntityKind = "granth" | "topic" | "praman" | "adhyay" | "folder";

export type FeedbackMode = "general" | "request";

export type FeedbackStatus = "pending" | "review" | "approved" | "rejected" | "progress" | "completed" | "info";

export type Priority = "low" | "normal" | "high";

export type RequestType =
  | "add_granth"
  | "add_praman"
  | "add_topic"
  | "add_pdf"
  | "incorrect"
  | "missing_page"
  | "other";

export type Draft = {
  id: string;
  entity: EntityKind;
  origin: "server" | "local";
  status: PublishStatus;
  deletedAt: number | null;
  signature: string;
  conflict: boolean;
  touched: boolean;
  updatedAt: number;
  version: number;
  title: string;
  description: string;
  position: string;
  topicId: string;
  granthId: string;
  author: string;
  imagePath: string;
  editorImagePath: string;
  granthURL: string;
  pageCount: string;
  pageLabel: string;
  chapter: string;
  pdfName: string;
  pdfUrl: string;
  pdfSize: number;
  pdfMime: string;
  folderId: string;
  parentId: string;
  youtubeUrl: string;
  youtubeStart: string;
  youtubeDesc: string;
  imageMime: string;
  imageSize: number;
  imageWidth: number;
  imageHeight: number;
  startPage: string;
  endPage: string;
  name: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: number;
};

export type FeedbackItem = {
  id: string;
  mode: FeedbackMode;
  requestType: RequestType | "";
  name: string;
  mobile: string;
  description: string;
  granthId: string;
  topicId: string;
  pramanId: string;
  status: FeedbackStatus;
  priority: Priority;
  assigneeId: string;
  note: string;
  attachmentName: string;
  attachmentMime: string;
  attachmentSize: number;
  createdAt: number;
  updatedAt: number;
};

export type AdminEvent = {
  id: string;
  type: string;
  entityId: string;
  label: string;
  device: string;
  at: number;
  day: string;
};

export type ActivityLog = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  meta: string;
  at: number;
};

export type SessionUser = {
  token: string;
  user: AdminUser;
  expiresAt: number;
};

export function emptyDraft(entity: EntityKind, id: string, origin: "server" | "local"): Draft {
  return {
    id,
    entity,
    origin,
    status: origin === "server" ? "published" : "draft",
    deletedAt: null,
    signature: "",
    conflict: false,
    touched: false,
    updatedAt: Date.now(),
    version: 1,
    title: "",
    description: "",
    position: "0",
    topicId: "",
    granthId: "",
    author: "",
    imagePath: "",
    editorImagePath: "",
    granthURL: "",
    pageCount: "",
    pageLabel: "",
    chapter: "",
    pdfName: "",
    pdfUrl: "",
    pdfSize: 0,
    pdfMime: "",
    folderId: "",
    parentId: "",
    youtubeUrl: "",
    youtubeStart: "",
    youtubeDesc: "",
    imageMime: "",
    imageSize: 0,
    imageWidth: 0,
    imageHeight: 0,
    startPage: "",
    endPage: "",
    name: "",
  };
}
