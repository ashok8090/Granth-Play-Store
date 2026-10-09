import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const PLAY = "https://play.google.com/store/apps/details?id=com.wnm.granthprabandhan";

function intentFor(search: string) {
  const query = search.startsWith("?") || search.length === 0 ? search : `?${search}`;
  return `intent://open${query}#Intent;scheme=granth;package=com.wnm.granthprabandhan;S.browser_fallback_url=${encodeURIComponent(PLAY)};end`;
}

export const Route = createFileRoute("/open")({
  head: () => ({
    meta: [
      { title: "ग्रंथ प्रबंधन" },
      { name: "description", content: "ग्रंथ प्रबंधन ऐप में खोलें। ऐप न हो तो Play Store।" },
      { property: "og:title", content: "ग्रंथ प्रबंधन" },
      { property: "og:description", content: "यह लिंक ऐप में ग्रंथ, विषय या प्रमाण खोलता है।" },
      { property: "og:image", content: "https://granth.grok.me/og.jpg" },
    ],
  }),
  component: OpenLink,
});

function OpenLink() {
  const [intent, setIntent] = useState(PLAY);
  useEffect(() => {
    const next = intentFor(window.location.search || "");
    setIntent(next);
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.replace(PLAY);
    }, 2200);
    window.location.href = next;
    const onHide = () => {
      if (document.visibilityState === "hidden") window.clearTimeout(timer);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fdf6e3",
        color: "#4a2c0a",
        fontFamily: "Noto Sans Devanagari, sans-serif",
      }}
    >
      <section style={{ width: "min(420px, 100%)", background: "#fffdf7", border: "1px solid #e2c97e", borderRadius: 18, padding: 22 }}>
        <h1 style={{ margin: "0 0 8px", color: "#7b1f2e", fontSize: 32, fontWeight: 500 }}>ग्रंथ प्रबंधन</h1>
        <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>ऐप खुल रही है। ऐप इस फ़ोन में न हो तो Play Store पर ग्रंथ प्रबंधन खुल जाएगा।</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={intent} style={{ background: "#7b1f2e", color: "#fffdf7", borderRadius: 999, padding: "10px 16px", fontWeight: 700, textDecoration: "none" }}>
            ऐप खोलें
          </a>
          <a href={PLAY} style={{ border: "1px solid #7b1f2e", color: "#7b1f2e", borderRadius: 999, padding: "10px 16px", fontWeight: 700, textDecoration: "none" }}>
            Play Store
          </a>
        </div>
      </section>
    </main>
  );
}
