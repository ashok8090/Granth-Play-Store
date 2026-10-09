import type { Draft } from "./admin-model";
import type { Catalog, Granth, Praman, Topic } from "./types";

function paintTopic(base: Topic | undefined, draft: Draft): Topic {
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    position: draft.position || base?.position || "0",
    user: base?.user || "admin",
    created_at: base?.created_at || new Date(draft.updatedAt).toISOString().slice(0, 19).replace("T", " "),
    granth_count: base?.granth_count || "0",
    praman_count: base?.praman_count || "0",
  };
}

function paintGranth(base: Granth | undefined, draft: Draft): Granth {
  return {
    id: draft.id,
    title: draft.title,
    author: draft.author,
    topic_id: draft.topicId || null,
    description: draft.description,
    imagePath: draft.imagePath,
    editorImagePath: draft.editorImagePath,
    granthURL: draft.granthURL,
    position: draft.position || base?.position || "0",
    user: base?.user || "admin",
    created_at: base?.created_at || new Date(draft.updatedAt).toISOString().slice(0, 19).replace("T", " "),
    pramanCount: base?.pramanCount || "0",
  };
}

function publicTitle(draft: Draft): string {
  const title = draft.title.trim();
  const page = draft.pageLabel.trim();
  if (!page || title.includes(page)) return title;
  if (draft.origin !== "local") return title;
  return `${title} पेज ${page}`.trim();
}

function paintPraman(base: Praman | undefined, draft: Draft, topics: Map<string, Topic>, granths: Map<string, Granth>): Praman {
  const topic = topics.get(draft.topicId);
  const granth = granths.get(draft.granthId);
  return {
    id: draft.id,
    title: publicTitle(draft),
    description: draft.description,
    is_favorate: base?.is_favorate || "0",
    topic_id: draft.topicId,
    granth_id: draft.granthId,
    image_path: draft.imagePath,
    youtube_url: draft.youtubeUrl,
    youtube_start: draft.youtubeStart,
    youtube_desc: draft.youtubeDesc,
    user: base?.user || "admin",
    created_at: base?.created_at || new Date(draft.updatedAt).toISOString().slice(0, 19).replace("T", " "),
    topic_title: topic?.title || base?.topic_title || "",
    granth_title: granth?.title || base?.granth_title || "",
    granth_image: granth?.imagePath || base?.granth_image || "",
    editorImagePath: granth?.editorImagePath || base?.editorImagePath || "",
    granth_auther: granth?.author || base?.granth_auther || "",
  };
}

function visible(draft: Draft | undefined): "keep" | "hide" | "apply" {
  if (!draft || !draft.touched) return "keep";
  if (draft.conflict) return "keep";
  if (draft.deletedAt || draft.status === "unpublished") return "hide";
  if (draft.status === "published") return "apply";
  return "keep";
}

export function mergeCatalog(catalog: Catalog, drafts: Draft[]): Catalog {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const topicDrafts = drafts.filter((draft) => draft.entity === "topic");
  const granthDrafts = drafts.filter((draft) => draft.entity === "granth");
  const pramanDrafts = drafts.filter((draft) => draft.entity === "praman");

  const topics: Topic[] = [];
  for (const topic of catalog.topics) {
    const mode = visible(byId.get(topic.id));
    if (mode === "hide") continue;
    topics.push(mode === "apply" ? paintTopic(topic, byId.get(topic.id) as Draft) : topic);
  }
  for (const draft of topicDrafts) {
    if (draft.origin === "local" && visible(draft) === "apply") topics.push(paintTopic(undefined, draft));
  }

  const granths: Granth[] = [];
  for (const granth of catalog.granths) {
    const mode = visible(byId.get(granth.id));
    if (mode === "hide") continue;
    granths.push(mode === "apply" ? paintGranth(granth, byId.get(granth.id) as Draft) : granth);
  }
  for (const draft of granthDrafts) {
    if (draft.origin === "local" && visible(draft) === "apply") granths.push(paintGranth(undefined, draft));
  }

  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const granthMap = new Map(granths.map((granth) => [granth.id, granth]));
  const pramans: Praman[] = [];
  for (const praman of catalog.pramans) {
    const mode = visible(byId.get(praman.id));
    if (mode === "hide") continue;
    if (mode === "apply") {
      const next = paintPraman(praman, byId.get(praman.id) as Draft, topicMap, granthMap);
      if (next.granth_id && !granthMap.has(next.granth_id)) continue;
      pramans.push(next);
    } else if (!praman.granth_id || granthMap.has(praman.granth_id)) {
      pramans.push(praman);
    }
  }
  for (const draft of pramanDrafts) {
    if (draft.origin === "local" && visible(draft) === "apply") {
      if (draft.granthId && !granthMap.has(draft.granthId)) continue;
      pramans.push(paintPraman(undefined, draft, topicMap, granthMap));
    }
  }

  const pramanByGranth = new Map<string, number>();
  const pramanByTopic = new Map<string, number>();
  for (const praman of pramans) {
    pramanByGranth.set(praman.granth_id, (pramanByGranth.get(praman.granth_id) ?? 0) + 1);
    pramanByTopic.set(praman.topic_id, (pramanByTopic.get(praman.topic_id) ?? 0) + 1);
  }
  const granthByTopic = new Map<string, number>();
  for (const granth of granths) {
    if (granth.topic_id) granthByTopic.set(granth.topic_id, (granthByTopic.get(granth.topic_id) ?? 0) + 1);
  }

  return {
    topics: topics.map((topic) => ({
      ...topic,
      granth_count: String(granthByTopic.get(topic.id) ?? 0),
      praman_count: String(pramanByTopic.get(topic.id) ?? 0),
    })),
    granths: granths.map((granth) => ({
      ...granth,
      pramanCount: String(pramanByGranth.get(granth.id) ?? 0),
    })),
    pramans,
    syncedAt: catalog.syncedAt,
  };
}
