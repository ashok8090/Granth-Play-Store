import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraft } from "./admin-model.ts";
import { mergeCatalog } from "./admin-merge.ts";
import { assertCanAssign, AdminError } from "./admin-roles.ts";
import type { Catalog, Granth, Praman, Topic } from "./types.ts";

const topic: Topic = {
  id: "t1",
  title: "गीता",
  description: "पैर",
  position: "1",
  user: "2",
  created_at: "2026-01-01",
  granth_count: "1",
  praman_count: "1",
};
const granth: Granth = {
  id: "g1",
  title: "श्रीमद्भगवत गीता",
  author: "गीताप्रेस",
  topic_id: "t1",
  description: "",
  imagePath: "granths/a.jpg",
  editorImagePath: "",
  granthURL: "https://archive.org/gita",
  position: "2",
  user: "2",
  created_at: "2026-01-01",
  pramanCount: "1",
};
const praman: Praman = {
  id: "p1",
  title: "अध्याय 2",
  description: "कर्म",
  is_favorate: "0",
  topic_id: "t1",
  granth_id: "g1",
  image_path: "granths/p.jpg",
  youtube_url: "",
  youtube_start: "",
  youtube_desc: "",
  user: "2",
  created_at: "2026-01-01",
  topic_title: "गीता",
  granth_title: "श्रीमद्भगवत गीता",
  granth_image: "granths/a.jpg",
  editorImagePath: "",
  granth_auther: "गीताप्रेस",
};

function catalog(): Catalog {
  return { topics: [topic], granths: [granth], pramans: [praman], syncedAt: 1 };
}

test("untouched drafts do not change the public catalog", () => {
  const draft = emptyDraft("granth", "g1", "server");
  draft.title = "बदल गया";
  const next = mergeCatalog(catalog(), [draft]);
  assert.equal(next.granths[0]?.title, "श्रीमद्भगवत गीता");
  assert.equal(next.pramans.length, 1);
});

test("published edit replaces a granth and a hidden granth drops its pramans", () => {
  const edit = emptyDraft("granth", "g1", "server");
  edit.title = "गीता संशोधित";
  edit.author = granth.author;
  edit.touched = true;
  edit.status = "published";
  const hidden = emptyDraft("praman", "p1", "server");
  hidden.touched = true;
  hidden.deletedAt = 10;
  const next = mergeCatalog(catalog(), [edit, hidden]);
  assert.equal(next.granths[0]?.title, "गीता संशोधित");
  assert.equal(next.granths[0]?.granthURL, "");
  assert.equal(next.pramans.length, 0);
  assert.equal(next.granths[0]?.pramanCount, "0");
});

test("local published praman is added and conflict keeps the server title", () => {
  const local = emptyDraft("praman", "local1", "local");
  local.title = "नया प्रमाण";
  local.pageLabel = "18";
  local.topicId = "t1";
  local.granthId = "g1";
  local.imagePath = "uploads/admin-abc.jpg";
  local.touched = true;
  local.status = "published";
  const conflict = emptyDraft("granth", "g1", "server");
  conflict.title = "मेरा ड्राफ्ट";
  conflict.touched = true;
  conflict.status = "published";
  conflict.conflict = true;
  const next = mergeCatalog(catalog(), [local, conflict]);
  assert.equal(next.granths[0]?.title, "श्रीमद्भगवत गीता");
  assert.equal(next.pramans.length, 2);
  assert.equal(next.pramans.find((item) => item.id === "local1")?.title, "नया प्रमाण पेज 18");
});

test("admin cannot create a super admin or another admin", () => {
  assert.throws(() => assertCanAssign("ADMIN", "SUPER_ADMIN"), (error: unknown) => error instanceof AdminError);
  assert.throws(() => assertCanAssign("ADMIN", "ADMIN"), (error: unknown) => error instanceof AdminError);
  assert.doesNotThrow(() => assertCanAssign("ADMIN", "EDITOR"));
  assert.throws(() => assertCanAssign("SUPER_ADMIN", "SUPER_ADMIN"), (error: unknown) => error instanceof AdminError);
  assert.throws(() => assertCanAssign("EDITOR", "USER"), (error: unknown) => error instanceof AdminError);
});
