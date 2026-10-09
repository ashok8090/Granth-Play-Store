import { useEffect, useRef, useState, type ReactNode } from "react";

export function MalaMark() {
  return (
    <svg className="mala" viewBox="0 0 48 48" aria-hidden="true">
      <circle className="mala-ring" cx="24" cy="24" r="15" />
      {Array.from({ length: 14 }, (_, index) => {
        const angle = (index / 14) * Math.PI * 2 - Math.PI / 2;
        const cx = (24 + Math.cos(angle) * 15).toFixed(2);
        const cy = (24 + Math.sin(angle) * 15).toFixed(2);
        return <circle key={index} className="mala-bead" cx={cx} cy={cy} r="2.15" />;
      })}
      <circle className="mala-guru" cx="24" cy="7.2" r="3.3" />
    </svg>
  );
}

export function ScrollRail({ hidden = false }: { hidden?: boolean }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 72 });
  const [railTop, setRailTop] = useState(96);
  const [show, setShow] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const hideTimer = useRef<number | null>(null);

  const reveal = () => {
    setShow(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!drag.current) setShow(false);
    }, 700);
  };

  useEffect(() => {
    let frame = 0;
    const update = () => {
      let chrome = 8;
      for (const node of document.querySelectorAll<HTMLElement>(".mast, nav, .sync-strip, .offline-ask")) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom > 4 && rect.top < window.innerHeight * 0.45) chrome = Math.max(chrome, rect.bottom + 8);
      }
      setRailTop(chrome);
      const track = trackRef.current?.clientHeight ?? Math.max(1, window.innerHeight - chrome - 40);
      const scrollHeight = document.documentElement.scrollHeight;
      const view = window.innerHeight;
      const max = Math.max(0, scrollHeight - view);
      setCanScroll(max > 8);
      const height = max <= 1 ? track : Math.max(64, Math.min(track, (view / scrollHeight) * track));
      const top = max <= 1 ? 0 : (window.scrollY / max) * Math.max(0, track - height);
      setThumb({ top: Number.isFinite(top) ? top : 0, height });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const onScroll = () => {
      reveal();
      schedule();
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (hidden || !canScroll) return null;

  const nudge = (direction: number) => {
    window.scrollBy({ top: direction * Math.round(window.innerHeight * 0.82), behavior: "smooth" });
  };

  const jump = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rail = track.getBoundingClientRect();
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const travel = Math.max(1, rail.height - thumb.height);
    const ratio = Math.min(1, Math.max(0, (clientY - rail.top - thumb.height / 2) / travel));
    window.scrollTo({ top: ratio * max });
  };

  return (
    <div className={`scroll-rail${show ? " show" : ""}`} style={{ top: railTop }} aria-hidden="true">
      <button className="scroll-arrow up" type="button" tabIndex={-1} onClick={() => nudge(-1)} aria-label="ऊपर">
        <svg viewBox="0 0 12 8" width="12" height="8">
          <path d="M1 7 L6 1.5 L11 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="scroll-track"
        ref={trackRef}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest(".scroll-thumb")) return;
          const track = event.currentTarget;
          track.setPointerCapture(event.pointerId);
          jump(event.clientY);
          const move = (next: PointerEvent) => jump(next.clientY);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div
          className="scroll-thumb"
          style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            const thumbNode = event.currentTarget;
            thumbNode.setPointerCapture(event.pointerId);
            drag.current = { y: event.clientY, scroll: window.scrollY };
            const move = (next: PointerEvent) => {
              const start = drag.current;
              const track = trackRef.current;
              if (!start || !track) return;
              const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
              const travel = Math.max(1, track.clientHeight - thumb.height);
              window.scrollTo({ top: start.scroll + ((next.clientY - start.y) / travel) * max });
            };
            const up = () => {
              drag.current = null;
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <span className="scroll-grip" />
        </div>
      </div>
      <button className="scroll-arrow down" type="button" tabIndex={-1} onClick={() => nudge(1)} aria-label="नीचे">
        <svg viewBox="0 0 12 8" width="12" height="8">
          <path d="M1 1 L6 6.5 L11 1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => (
        <span key={`${index}-${line.slice(0, 12)}`}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

export function IconBox({
  tone,
  children,
  className,
}: {
  tone: "saffron" | "maroon" | "gold" | "plain";
  children: ReactNode;
  className?: string;
}) {
  return <span className={`icon-box tone-${tone} ${className ?? ""}`}>{children}</span>;
}
