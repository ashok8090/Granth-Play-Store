import { useEffect, useRef } from "react";
import { recordEvent } from "./admin-db";

export function noteEvent(type: string, entityId = "", label = "") {
  void recordEvent(type, entityId, label).catch(() => undefined);
}

export function useSearchMetric(query: string, resultCount: number) {
  const last = useRef("");
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const handle = window.setTimeout(() => {
      const key = `${text}|${resultCount === 0 ? "empty" : "hit"}`;
      if (last.current === key) return;
      last.current = key;
      noteEvent(resultCount === 0 ? "search_empty" : "search", "search", text);
    }, 800);
    return () => window.clearTimeout(handle);
  }, [query, resultCount]);
}
