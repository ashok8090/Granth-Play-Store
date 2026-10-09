import { useEffect, useMemo, useState } from "react";
import { MediaImage } from "@/components/granth/media-image";
import {
  discardDraft,
  draftFromGranth,
  draftFromPraman,
  draftFromTopic,
  granthSignature,
  listDrafts,
  newLocalDraft,
  pramanSignature,
  restoreDraft,
  saveDraft,
  softDeleteDraft,
  storeOriginal,
  topicSignature,
} from "@/lib/granth/admin-db";
import { emptyDraft, type Draft, type EntityKind, type Role } from "@/lib/granth/admin-model";
import { canContent } from "@/lib/granth/admin-roles";
import { prepareFields, rankPrepared } from "@/lib/granth/search";
import { serverCatalog, useGranth } from "@/lib/granth/store";
import type { Granth, Praman, Topic } from "@/lib/granth/types";
import { Banner, errorText, Field, Sheet, useAdminRev } from "./kit";

type Row = {
  id: string;
  title: string;
  meta: string;
  state: string;
  draft: Draft | null;
  signature: string;
};

const TITLES: Record<EntityKind, string> = {
  granth: "ग्रंथ",
  topic: "विषय",
  praman: "प्रमाण",
  folder: "फ़ोल्डर",
  adhyay: "अध्याय",
};

export function ManageScreen({ entity, role }: { entity: "granth" | "topic" | "praman" | "folder"; role: Role }) {
  const rev = useAdminRev();
  const granths = useGranth((state) => state.granths);
  const topics = useGranth((state) => state.topics);
  const pramans = useGranth((state) => state.pramans);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const allowed = canContent(role);

  useEffect(() => {
    void listDrafts().then(setDrafts);
  }, [rev]);

  const folders = drafts.filter((draft) => draft.entity === "folder" && !draft.deletedAt);
  const adhyays = drafts.filter((draft) => draft.entity === "adhyay");

  const rows = useMemo(() => {
    const mine = drafts.filter((draft) => draft.entity === entity);
    const map = new Map(mine.map((draft) => [draft.id, draft]));
    const list: Row[] = [];
    if (entity === "granth") {
      for (const granth of granths) list.push(rowFrom(granth.title, `${granth.author} · प्रमाण ${granth.pramanCount}`, granthSignature(granth), map.get(granth.id) ?? null, granth.id));
    } else if (entity === "topic") {
      for (const topic of topics) list.push(rowFrom(topic.title, topic.description, topicSignature(topic), map.get(topic.id) ?? null, topic.id));
    } else if (entity === "praman") {
      for (const praman of pramans) {
        list.push(rowFrom(praman.title, `${praman.granth_title} · ${praman.topic_title}`, pramanSignature(praman), map.get(praman.id) ?? null, praman.id));
      }
    }
    for (const draft of mine) {
      if (draft.origin === "local") list.push(rowFrom(draft.title || draft.name, draft.description || draft.parentId, "", draft, draft.id));
    }
    return list;
  }, [drafts, entity, granths, pramans, topics]);

  const filtered = useMemo(() => {
    const narrowed = rows.filter((row) => filter === "all" || row.state === filter);
    return rankPrepared(narrowed, query, (row) => prepareFields([row.title, row.meta]));
  }, [filter, query, rows]);

  const openServer = (row: Row) => {
    if (row.draft) {
      setEditing({ ...row.draft, signature: row.signature || row.draft.signature });
      return;
    }
    if (entity === "granth") {
      const granth = granths.find((item) => item.id === row.id);
      if (granth) setEditing(draftFromGranth(granth));
    } else if (entity === "topic") {
      const topic = topics.find((item) => item.id === row.id);
      if (topic) setEditing(draftFromTopic(topic));
    } else if (entity === "praman") {
      const praman = pramans.find((item) => item.id === row.id);
      if (praman) setEditing(draftFromPraman(praman));
    }
  };

  return (
    <section className="adm-stack">
      <div className="adm-head">
        <h2>{TITLES[entity]}</h2>
        {allowed ? (
          <button
            className="adm-primary"
            type="button"
            onClick={() => {
              const draft = newLocalDraft(entity);
              if (entity === "folder") draft.name = "";
              setEditing(draft);
            }}
          >
            नया
          </button>
        ) : null}
      </div>
      <Banner text={error} />
      <input className="adm-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="खोजें" aria-label="खोज" />
      <div className="adm-chips">
        {[
          ["all", "सभी"],
          ["live", "लाइव"],
          ["draft", "ड्राफ्ट"],
          ["published", "प्रकाशित"],
          ["unpublished", "छुपे"],
          ["conflict", "टकराव"],
          ["deleted", "हटाए"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="adm-muted">इस फ़िल्टर में कुछ नहीं।</p> : null}
      {filtered.map((row) => (
        <article key={row.id} className="adm-card">
          <div className="adm-head">
            <h3>{row.title || "बिना नाम"}</h3>
            <span className="adm-pill">{stateLabel(row.state)}</span>
          </div>
          <p className="adm-muted">{row.meta}</p>
          <div className="adm-actions">
            <button type="button" onClick={() => (row.draft && entity === "folder" ? setEditing({ ...row.draft }) : openServer(row))}>
              संपादन
            </button>
            {entity !== "folder" ? (
              <button type="button" onClick={() => setPreview(row.draft ?? previewDraft(entity, row, granths, topics, pramans))}>
                झलक
              </button>
            ) : null}
            {allowed && row.draft?.deletedAt ? (
              <button type="button" onClick={() => void restoreDraft(row.id).catch((reason: unknown) => setError(errorText(reason)))}>
                वापस
              </button>
            ) : null}
          </div>
        </article>
      ))}
      {editing ? (
        <Editor
          draft={editing}
          liveSignature={liveSignature(editing, granths, topics, pramans)}
          folders={folders}
          adhyays={adhyays}
          granths={granths}
          topics={topics}
          allowed={allowed}
          onClose={() => setEditing(null)}
          onError={setError}
        />
      ) : null}
      {preview ? (
        <Sheet title="यूज़र ऐप में झलक" onClose={() => setPreview(null)}>
          <article className="adm-preview">
            <MediaImage path={preview.imagePath || preview.editorImagePath} alt={preview.title} />
            <h3>{preview.title || preview.name}</h3>
            <p>{preview.author}</p>
            <p>{preview.description}</p>
            <p className="adm-muted">
              {[preview.pageLabel && `पृष्ठ ${preview.pageLabel}`, preview.chapter && `अध्याय ${preview.chapter}`, preview.youtubeUrl]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>
        </Sheet>
      ) : null}
    </section>
  );
}

function liveSignature(draft: Draft, granths: Granth[], topics: Topic[], pramans: Praman[]): string {
  if (draft.origin !== "server") return "";
  const raw = serverCatalog();
  const granthRows = raw?.granths ?? granths;
  const topicRows = raw?.topics ?? topics;
  const pramanRows = raw?.pramans ?? pramans;
  if (draft.entity === "granth") {
    const granth = granthRows.find((item) => item.id === draft.id);
    return granth ? granthSignature(granth) : draft.signature;
  }
  if (draft.entity === "topic") {
    const topic = topicRows.find((item) => item.id === draft.id);
    return topic ? topicSignature(topic) : draft.signature;
  }
  if (draft.entity === "praman") {
    const praman = pramanRows.find((item) => item.id === draft.id);
    return praman ? pramanSignature(praman) : draft.signature;
  }
  return "";
}

function previewDraft(entity: EntityKind, row: Row, granths: Granth[], topics: Topic[], pramans: Praman[]): Draft {
  if (entity === "granth") {
    const granth = granths.find((item) => item.id === row.id);
    return granth ? draftFromGranth(granth) : emptyDraft("granth", row.id, "server");
  }
  if (entity === "topic") {
    const topic = topics.find((item) => item.id === row.id);
    return topic ? draftFromTopic(topic) : emptyDraft("topic", row.id, "server");
  }
  const praman = pramans.find((item) => item.id === row.id);
  return praman ? draftFromPraman(praman) : emptyDraft("praman", row.id, "server");
}

function rowFrom(title: string, meta: string, signature: string, draft: Draft | null, id: string): Row {
  let state = "live";
  if (draft?.deletedAt) state = "deleted";
  else if (draft?.conflict) state = "conflict";
  else if (draft?.touched && draft.status === "draft") state = "draft";
  else if (draft?.touched && draft.status === "published") state = "published";
  else if (draft?.touched && draft.status === "unpublished") state = "unpublished";
  const shown = draft?.touched ? draft.title || draft.name || title : title;
  return { id, title: shown, meta: draft?.touched ? draft.description || meta : meta, state, draft, signature };
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    live: "लाइव",
    draft: "ड्राफ्ट",
    published: "प्रकाशित",
    unpublished: "छुपा",
    conflict: "टकराव",
    deleted: "हटाया",
  };
  return labels[state] ?? state;
}

function Editor({
  draft,
  liveSignature: serverNow,
  folders,
  adhyays,
  granths,
  topics,
  allowed,
  onClose,
  onError,
}: {
  draft: Draft;
  liveSignature: string;
  folders: Draft[];
  adhyays: Draft[];
  granths: Granth[];
  topics: Topic[];
  allowed: boolean;
  onClose: () => void;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const patch = (partial: Partial<Draft>) => setForm((current) => ({ ...current, ...partial }));
  const granthId = form.entity === "granth" ? form.id : form.granthId;
  const chapterRows = adhyays.filter((item) => item.granthId === granthId && !item.deletedAt);

  const commit = (status: Draft["status"], force = false) => {
    setBusy(true);
    setNote("");
    void saveDraft({ ...form, status, conflict: force }, serverNow)
      .then(() => onClose())
      .catch((reason: unknown) => {
        const message = errorText(reason);
        setNote(message);
        onError(message);
        if (message.includes("सर्वर")) patch({ conflict: true });
      })
      .finally(() => setBusy(false));
  };

  const takeFile = async (file: File | undefined, slot: "cover" | "editor" | "praman" | "pdf") => {
    if (!file) return;
    setBusy(true);
    try {
      const stored = await storeOriginal(file, slot === "pdf" ? "pdf" : "image");
      if (slot === "cover" || slot === "praman") {
        patch({ imagePath: stored.path, imageMime: stored.mime, imageSize: stored.size, imageWidth: stored.width, imageHeight: stored.height });
      } else if (slot === "editor") {
        patch({ editorImagePath: stored.path });
      } else {
        patch({ pdfName: file.name, pdfUrl: stored.path, pdfMime: stored.mime, pdfSize: stored.size });
      }
      setNote("मूल फ़ाइल बिना सिकोड़ें रख ली गई।");
    } catch (reason) {
      setNote(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={form.origin === "local" ? "नया" : "संपादन"} onClose={onClose}>
      <Banner text={note} />
      {form.entity !== "folder" ? (
        <Field label="शीर्षक">
          <input value={form.title} onChange={(event) => patch({ title: event.target.value })} />
        </Field>
      ) : (
        <Field label="फ़ोल्डर का नाम">
          <input value={form.name} onChange={(event) => patch({ name: event.target.value, title: event.target.value })} />
        </Field>
      )}
      {form.entity !== "folder" && form.entity !== "adhyay" ? (
        <Field label="विवरण">
          <textarea rows={4} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
      ) : null}
      {form.entity === "granth" ? (
        <>
          <Field label="लेखक / ऋषि">
            <input value={form.author} onChange={(event) => patch({ author: event.target.value })} />
          </Field>
          <Field label="विषय">
            <select value={form.topicId} onChange={(event) => patch({ topicId: event.target.value })}>
              <option value="">कोई नहीं</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="कुल पृष्ठ">
            <input value={form.pageCount} onChange={(event) => patch({ pageCount: event.target.value })} inputMode="numeric" />
          </Field>
          <Field label="बाहरी PDF लिंक">
            <input value={form.granthURL} onChange={(event) => patch({ granthURL: event.target.value })} />
          </Field>
          <Field label="PDF फ़ाइल">
            <input type="file" accept="application/pdf" onChange={(event) => void takeFile(event.target.files?.[0], "pdf")} />
          </Field>
          {form.pdfName ? <p className="adm-muted">{form.pdfName} · {form.pdfMime} · {form.pdfSize} बाइट</p> : null}
          <Field label="आवरण">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void takeFile(event.target.files?.[0], "cover")} />
          </Field>
          <Field label="प्रकाशन चित्र">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void takeFile(event.target.files?.[0], "editor")} />
          </Field>
          {form.imageMime ? (
            <p className="adm-muted">
              मूल चित्र {form.imageWidth}×{form.imageHeight} · {form.imageMime} · {form.imageSize} बाइट
            </p>
          ) : null}
        </>
      ) : null}
      {form.entity === "topic" || form.entity === "praman" ? (
        <Field label="ग्रंथ">
          <select value={form.granthId} onChange={(event) => patch({ granthId: event.target.value })}>
            <option value="">चुनें</option>
            {granths.map((granth) => (
              <option key={granth.id} value={granth.id}>
                {granth.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {form.entity === "praman" ? (
        <>
          <Field label="विषय">
            <select value={form.topicId} onChange={(event) => patch({ topicId: event.target.value })}>
              <option value="">चुनें</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="अध्याय">
            <select value={form.parentId} onChange={(event) => patch({ parentId: event.target.value })}>
              <option value="">कोई नहीं</option>
              {chapterRows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="पृष्ठ">
            <input value={form.pageLabel} onChange={(event) => patch({ pageLabel: event.target.value })} />
          </Field>
          <Field label="अध्याय संख्या">
            <input value={form.chapter} onChange={(event) => patch({ chapter: event.target.value })} />
          </Field>
          <Field label="YouTube">
            <input value={form.youtubeUrl} onChange={(event) => patch({ youtubeUrl: event.target.value })} />
          </Field>
          <Field label="YouTube शुरू">
            <input value={form.youtubeStart} onChange={(event) => patch({ youtubeStart: event.target.value })} />
          </Field>
          <Field label="YouTube विवरण">
            <textarea rows={3} value={form.youtubeDesc} onChange={(event) => patch({ youtubeDesc: event.target.value })} />
          </Field>
          <Field label="मूल चित्र">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void takeFile(event.target.files?.[0], "praman")} />
          </Field>
        </>
      ) : null}
      {form.entity === "folder" ? (
        <Field label="मूल फ़ोल्डर">
          <select value={form.parentId} onChange={(event) => patch({ parentId: event.target.value })}>
            <option value="">जड़</option>
            {folders
              .filter((folder) => folder.id !== form.id)
              .map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name || folder.title}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <Field label="फ़ोल्डर">
          <select value={form.folderId} onChange={(event) => patch({ folderId: event.target.value })}>
            <option value="">कोई नहीं</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name || folder.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="क्रम">
        <input value={form.position} onChange={(event) => patch({ position: event.target.value })} inputMode="numeric" />
      </Field>
      {form.entity === "granth" ? <AdhyayEditor granthId={form.id} rows={chapterRows} allowed={allowed} onError={onError} /> : null}
      {form.conflict ? (
        <div className="adm-actions">
          <button type="button" onClick={() => commit(form.status, true)}>
            अपनी प्रति रखें
          </button>
          <button type="button" onClick={() => void discardDraft(form.id).then(onClose)}>
            सर्वर वाली रखें
          </button>
        </div>
      ) : null}
      {allowed ? (
        <div className="adm-actions">
          <button type="button" disabled={busy} onClick={() => commit("draft")}>
            ड्राफ्ट
          </button>
          <button type="button" className="adm-primary" disabled={busy} onClick={() => commit("published")}>
            प्रकाशित
          </button>
          <button type="button" disabled={busy} onClick={() => commit("unpublished")}>
            छुपाएँ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("हटाना सॉफ्ट है। बच्चे वाली सामग्री मिटेगी नहीं, ऊपर के फ़ोल्डर में चली जाएगी।")) return;
              void saveDraft({ ...form, status: "draft" })
                .then((saved) => softDeleteDraft(saved.id))
                .then(onClose)
                .catch((reason: unknown) => setNote(errorText(reason)));
            }}
          >
            हटाएँ
          </button>
        </div>
      ) : (
        <p className="adm-muted">यह खाता सिर्फ़ देख सकता है।</p>
      )}
    </Sheet>
  );
}

function AdhyayEditor({
  granthId,
  rows,
  allowed,
  onError,
}: {
  granthId: string;
  rows: Draft[];
  allowed: boolean;
  onError: (text: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  if (!granthId) return null;
  const add = () => {
    const draft = newLocalDraft("adhyay");
    draft.granthId = granthId;
    draft.title = title.trim();
    draft.startPage = startPage;
    draft.endPage = endPage;
    draft.position = String(rows.length + 1);
    void saveDraft({ ...draft, status: "published" })
      .then(() => {
        setTitle("");
        setStartPage("");
        setEndPage("");
      })
      .catch((reason: unknown) => onError(errorText(reason)));
  };
  const move = (row: Draft, dir: -1 | 1) => {
    const ordered = [...rows].sort((a, b) => Number(a.position) - Number(b.position));
    const index = ordered.findIndex((item) => item.id === row.id);
    const swap = ordered[index + dir];
    if (!swap) return;
    const left = row.position;
    void saveDraft({ ...row, position: swap.position, status: "published" }).then(() =>
      saveDraft({ ...swap, position: left, status: "published" }),
    );
  };
  return (
    <div className="adm-card">
      <h3>अध्याय</h3>
      {rows
        .slice()
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((row) => (
          <div key={row.id} className="adm-line">
            <span>
              {row.title} · {row.startPage}–{row.endPage}
            </span>
            {allowed ? (
              <span className="adm-actions">
                <button type="button" onClick={() => move(row, -1)} aria-label="ऊपर">
                  ऊपर
                </button>
                <button type="button" onClick={() => move(row, 1)} aria-label="नीचे">
                  नीचे
                </button>
                <button type="button" onClick={() => void softDeleteDraft(row.id)}>
                  हटाएँ
                </button>
              </span>
            ) : null}
          </div>
        ))}
      {allowed ? (
        <>
          <Field label="नया अध्याय">
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <div className="adm-split">
            <Field label="आरंभ पृष्ठ">
              <input value={startPage} onChange={(event) => setStartPage(event.target.value)} inputMode="numeric" />
            </Field>
            <Field label="अंत पृष्ठ">
              <input value={endPage} onChange={(event) => setEndPage(event.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <button type="button" onClick={add}>
            अध्याय जोड़ें
          </button>
        </>
      ) : null}
    </div>
  );
}
