import { ChevronLeft, ChevronRight, FolderDown, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveGalleryItem } from "@/lib/granth/db";
import { deliverFile, openBlob, ping, shareBlob } from "@/lib/granth/files";
import { pushCloser } from "@/lib/granth/back";
import {
  cancelPdf,
  formatBytes,
  formatClock,
  formatEta,
  listenPdfReady,
  usePdfTasks,
  type PdfTask,
} from "@/lib/granth/pdf-jobs";

async function keepInApp(task: PdfTask) {
  if (!task.blob) return;
  const agreed = window.confirm(`क्या आप इस PDF को ऐप गैलरी में सेव करना चाहते हैं?\n${task.fileName}`);
  if (!agreed) return;
  await saveGalleryItem({
    id: task.galleryId,
    kind: "pdf",
    title: task.title,
    text: task.text,
    topic: task.topic,
    granth: task.granth,
    folderId: "",
    createdAt: Date.now(),
    size: task.blob.size,
    fileName: task.fileName,
    blob: task.blob,
    preview: task.preview,
  });
  ping("ऐप गैलरी में सेव हो गया");
}

function pdfFacts(task: PdfTask, now: number) {
  const end = task.finishedAt || (task.phase === "done" ? now : now);
  const elapsed = formatClock(Math.max(0, end - task.startedAt));
  const pages = task.total > 1 || task.phase === "pages" || task.phase === "done" ? `${task.phase === "done" ? task.total : task.done}/${task.total} पृष्ठ` : "";
  return [pages, `${elapsed} लगे`, formatEta(task.etaMs, task.phase)].filter(Boolean).join(" · ");
}

export function PdfDock() {
  const tasks = usePdfTasks();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState<PdfTask | null>(null);
  const [onDevice, setOnDevice] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const drag = useRef({ active: false, moved: false, dx: 0, dy: 0, x: 0, y: 0 });
  const [spot, setSpot] = useState({ x: 12, y: 220 });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pdf-ball") || "null") as { x?: number; y?: number } | null;
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        setSpot({ x: saved.x, y: saved.y });
        return;
      }
    } catch {
      /* ignore */
    }
    setSpot({ x: Math.max(12, window.innerWidth - 62), y: Math.round(window.innerHeight * 0.46) });
  }, []);
  const moveSpot = (x: number, y: number) => {
    const next = {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 64)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 64)),
    };
    setSpot(next);
    return next;
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(
    () =>
      listenPdfReady((task) => {
        setReady(task);
        setOnDevice(false);
        if (!task.blob) return;
        void deliverFile(task.blob, task.fileName).then(() => setOnDevice(true));
      }),
    [],
  );
  useEffect(() => {
    if (!ready) return;
    return pushCloser(() => setReady(null));
  }, [ready]);
  useEffect(() => {
    if (!open) return;
    return pushCloser(() => setOpen(false));
  }, [open]);
  useEffect(() => {
    if (index > tasks.length - 1) setIndex(Math.max(0, tasks.length - 1));
  }, [index, tasks.length]);
  const task = tasks[index];
  const active = tasks.filter((item) => item.phase === "queue" || item.phase === "images" || item.phase === "pages" || item.phase === "save").length;
  const shareNow = (item: PdfTask) => {
    if (!item.blob || sharing) return;
    setSharing(true);
    void shareBlob(item.blob, item.fileName).finally(() => setSharing(false));
  };
  return (
    <>
      {tasks.length ? (
        <>
          <button
            className="pdf-ball"
            type="button"
            style={{ left: spot.x, top: spot.y }}
            aria-expanded={open}
            aria-label="PDF प्रगति"
            onPointerDown={(event) => {
              drag.current = {
                active: true,
                moved: false,
                dx: event.clientX - spot.x,
                dy: event.clientY - spot.y,
                x: spot.x,
                y: spot.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current.active) return;
              const x = event.clientX - drag.current.dx;
              const y = event.clientY - drag.current.dy;
              if (Math.abs(x - drag.current.x) > 5 || Math.abs(y - drag.current.y) > 5) drag.current.moved = true;
              moveSpot(x, y);
            }}
            onPointerUp={(event) => {
              if (!drag.current.active) return;
              event.stopPropagation();
              drag.current.active = false;
              const next = moveSpot(event.clientX - drag.current.dx, event.clientY - drag.current.dy);
              try {
                localStorage.setItem("pdf-ball", JSON.stringify(next));
              } catch {
                /* ignore */
              }
              if (!drag.current.moved) setOpen((value) => !value);
            }}
          >
            {active || tasks.length}
          </button>
          {open && task ? (
            <>
              <div className="pdf-shade" onClick={() => setOpen(false)} />
              <div
                className="pdf-deck pdf-deck-float"
                role="dialog"
                aria-label="PDF प्रगति"
                style={{ left: Math.max(8, Math.min(spot.x - 80, window.innerWidth - 440)), top: Math.max(8, spot.y - 280) }}
                onClick={(event) => event.stopPropagation()}
              >
              <div className="pdf-deck-top">
                <strong>
                  {index + 1}/{tasks.length}
                </strong>
                <span>{task.percent}%</span>
              </div>
              <h3>{task.title}</h3>
              <div className="pdf-meter" aria-hidden="true">
                <span style={{ width: `${task.percent}%` }} />
              </div>
              <p>{pdfFacts(task, now)}</p>
              <p>{task.error || `${task.percent}% · ${task.phase === "images" ? "चित्र बन रहे हैं" : task.phase === "pages" ? "पृष्ठ जुड़ रहे हैं" : task.phase === "save" ? "सेव हो रहा है" : task.phase === "done" ? "तैयार" : "कतार में"}`}</p>
              <div className="pdf-deck-nav">
                <button type="button" className="pill" onClick={() => setOpen(false)}>
                  बंद
                </button>
                <button type="button" className="pill" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
                  <ChevronLeft /> पिछला
                </button>
                <button
                  type="button"
                  className="pill"
                  disabled={index >= tasks.length - 1}
                  onClick={() => setIndex((value) => Math.min(tasks.length - 1, value + 1))}
                >
                  अगला <ChevronRight />
                </button>
              </div>
              {task.phase === "images" || task.phase === "pages" || task.phase === "queue" || task.phase === "save" ? (
                <button type="button" className="pdf-back" onClick={() => cancelPdf(task.id)}>
                  रोकें
                </button>
              ) : null}
              {task.blob && task.phase === "done" ? (
                <div className="pdf-actions">
                  <button type="button" className="pdf-ok" onClick={() => void openBlob(task.blob as Blob, task.fileName)}>
                    PDF खोलें
                  </button>
                  <button type="button" className="pdf-back" disabled={sharing} onClick={() => shareNow(task)}>
                    <Share2 /> {sharing ? "खुल रहा है…" : "शेयर"}
                  </button>
                  <button type="button" className="pdf-back" onClick={() => void keepInApp(task)}>
                    <FolderDown /> सेव
                  </button>
                </div>
              ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {ready?.blob ? (
        <div className="pdf-pop" role="presentation" onClick={() => setReady(null)}>
          <div className="pdf-done" role="dialog" aria-modal="true" aria-label="PDF तैयार" onClick={(event) => event.stopPropagation()}>
            <button className="pill pdf-done-x" type="button" onClick={() => setReady(null)}>
              <X /> पीछे
            </button>
            <h3>{ready.fileName}</h3>
            <p>
              {ready.total} पृष्ठ · {formatClock(Math.max(0, (ready.finishedAt || now) - ready.startedAt))} · {formatBytes(ready.size || ready.blob.size)}
            </p>
            <p>{onDevice ? "Downloads और फ़ाइल मैनेजर में सेव हो गया" : "डिवाइस में सेव हो रहा है"}</p>
            <div className="pdf-actions">
              <button type="button" className="pdf-ok" onClick={() => void openBlob(ready.blob as Blob, ready.fileName)}>
                PDF खोलें
              </button>
              <button type="button" className="pdf-back" disabled={sharing} onClick={() => shareNow(ready)}>
                <Share2 /> {sharing ? "खुल रहा है…" : "शेयर"}
              </button>
              <button type="button" className="pdf-back" onClick={() => void keepInApp(ready)}>
                <FolderDown /> सेव
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
