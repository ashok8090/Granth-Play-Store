export type Topic = {
  id: string;
  title: string;
  description: string;
  position: string;
  user: string;
  created_at: string;
  granth_count: string;
  praman_count: string;
};

export type Granth = {
  id: string;
  title: string;
  author: string;
  topic_id: string | null;
  description: string;
  imagePath: string;
  editorImagePath: string;
  position: string;
  user: string;
  created_at: string;
  pramanCount: string;
};

export type Praman = {
  id: string;
  title: string;
  description: string;
  is_favorate: string;
  topic_id: string;
  granth_id: string;
  image_path: string;
  youtube_url: string;
  youtube_start: string;
  youtube_desc: string;
  user: string;
  created_at: string;
  topic_title: string;
  granth_title: string;
  granth_image: string;
  editorImagePath: string;
  granth_auther: string;
};

export type Catalog = {
  topics: Topic[];
  granths: Granth[];
  pramans: Praman[];
  syncedAt: number;
};

export type GalleryFolder = {
  id: string;
  name: string;
  createdAt: number;
};

export type GalleryItem = {
  id: string;
  kind: "image" | "pdf";
  title: string;
  text: string;
  topic: string;
  granth: string;
  folderId: string;
  createdAt: number;
  size: number;
  fileName: string;
  localUri: string;
  sourceId: string;
};

export type JobStatus = "queued" | "running" | "paused" | "done" | "failed" | "cancelled";

export type DownloadJob = {
  id: string;
  kind: "image" | "pdf" | "pack";
  title: string;
  url: string;
  dest: string;
  status: JobStatus;
  progress: number;
  bytes: number;
  error: string | null;
  createdAt: number;
  resumeData: string | null;
  sourcePath: string;
};

export type Settings = {
  granthCols: 1 | 2 | 3;
  pramanCols: 1 | 2;
  galleryCols: 1 | 2;
  theme: "paper" | "night";
};

export type ResourcePack = {
  resourceVersion: string;
  topics: Topic[];
  granths: Granth[];
  pramans: Praman[];
};

export type SaveMeta = {
  title: string;
  text: string;
  topic: string;
  granth: string;
  sourceId: string;
};
