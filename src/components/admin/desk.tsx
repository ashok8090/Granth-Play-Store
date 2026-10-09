import {
  BarChart3,
  BookOpen,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  ScrollText,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  bootstrapAdmin,
  contentVersion,
  currentSession,
  listDrafts,
  listEvents,
  listFeedback,
  loginAdmin,
  logoutAdmin,
  needsBootstrap,
} from "@/lib/granth/admin-db";
import type { AdminEvent, Draft, FeedbackItem, SessionUser } from "@/lib/granth/admin-model";
import { useGranth } from "@/lib/granth/store";
import { ManageScreen } from "./manage";
import { InboxScreen, LogsScreen, PeopleScreen, SettingsScreen } from "./inbox";
import { Banner, errorText, roleLabel, useAdminRev, when } from "./kit";

type Section = "home" | "granths" | "topics" | "pramans" | "folders" | "inbox" | "users" | "analytics" | "logs" | "settings";

const MORE: Array<{ id: Section; label: string; icon: typeof BookOpen }> = [
  { id: "topics", label: "विषय", icon: ScrollText },
  { id: "folders", label: "फ़ोल्डर", icon: FolderTree },
  { id: "users", label: "सदस्य", icon: Users },
  { id: "analytics", label: "आँकड़े", icon: BarChart3 },
  { id: "logs", label: "गतिविधि", icon: ScrollText },
  { id: "settings", label: "सेटिंग", icon: Settings },
];

function sectionFromHash(hash: string): Section {
  const path = hash.replace(/^#/, "");
  const name = path.split("/")[2] || "home";
  const known: Section[] = ["home", "granths", "topics", "pramans", "folders", "inbox", "users", "analytics", "logs", "settings"];
  return known.includes(name as Section) ? (name as Section) : "home";
}

export function AdminDesk({ onClose }: { onClose: () => void }) {
  const rev = useAdminRev();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [fresh, setFresh] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [more, setMore] = useState(false);
  const [night, setNight] = useState(false);

  useEffect(() => {
    const read = () => setSection(sectionFromHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    try {
      setNight(localStorage.getItem("granth-admin-night") === "1");
    } catch {
      /* ignore */
    }
    void currentSession()
      .then(async (next) => {
        setSession(next);
        setFresh(next ? false : await needsBootstrap());
      })
      .finally(() => setReady(true));
  }, [rev]);

  const go = (next: Section) => {
    setMore(false);
    const hash = next === "home" ? "#/admin" : `#/admin/${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    else setSection(next);
  };

  const leave = () => {
    void logoutAdmin().finally(onClose);
  };

  if (!ready || fresh === null) {
    return (
      <div className="adm">
        <p className="adm-wait">एडमिन डेस्क खुल रहा है…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Login
        fresh={fresh}
        night={night}
        onDone={setSession}
        onClose={onClose}
      />
    );
  }

  return (
    <div className={night ? "adm night" : "adm"}>
      <header className="adm-top">
        <div>
          <p className="adm-kicker">एडमिन डेस्क</p>
          <h1>ग्रंथ प्रबंधन</h1>
        </div>
        <div className="adm-top-actions">
          <button
            type="button"
            className="adm-icon"
            aria-label={night ? "दिन मोड" : "रात मोड"}
            onClick={() => {
              const next = !night;
              setNight(next);
              localStorage.setItem("granth-admin-night", next ? "1" : "0");
            }}
          >
            {night ? <Sun /> : <Moon />}
          </button>
          <button type="button" className="adm-icon" onClick={leave} aria-label="लॉग आउट">
            <LogOut />
          </button>
        </div>
      </header>
      <p className="adm-who">
        {session.user.name} · {roleLabel(session.user.role)}
      </p>
      <main className="adm-main">
        {section === "home" || section === "analytics" ? <Dashboard analytics={section === "analytics"} /> : null}
        {section === "granths" ? <ManageScreen entity="granth" role={session.user.role} /> : null}
        {section === "topics" ? <ManageScreen entity="topic" role={session.user.role} /> : null}
        {section === "pramans" ? <ManageScreen entity="praman" role={session.user.role} /> : null}
        {section === "folders" ? <ManageScreen entity="folder" role={session.user.role} /> : null}
        {section === "inbox" ? <InboxScreen role={session.user.role} /> : null}
        {section === "users" ? <PeopleScreen actor={session.user} /> : null}
        {section === "logs" ? <LogsScreen /> : null}
        {section === "settings" ? <SettingsScreen role={session.user.role} /> : null}
      </main>
      {more ? (
        <div className="adm-sheet" onClick={() => setMore(false)} role="presentation">
          <div className="adm-sheet-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="और">
            <div className="adm-more">
              {MORE.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => go(item.id)}>
                    <Icon /> {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      <nav className="adm-nav">
        <button type="button" className={section === "home" ? "on" : ""} onClick={() => go("home")}>
          <LayoutDashboard /> डेस्क
        </button>
        <button type="button" className={section === "granths" ? "on" : ""} onClick={() => go("granths")}>
          <BookOpen /> ग्रंथ
        </button>
        <button type="button" className={section === "pramans" ? "on" : ""} onClick={() => go("pramans")}>
          <ScrollText /> प्रमाण
        </button>
        <button type="button" className={section === "inbox" ? "on" : ""} onClick={() => go("inbox")}>
          <Inbox /> पत्र
        </button>
        <button type="button" className={more ? "on" : ""} onClick={() => setMore(true)}>
          <MoreHorizontal /> और
        </button>
      </nav>
    </div>
  );
}

function Login({
  fresh,
  night,
  onDone,
  onClose,
}: {
  fresh: boolean;
  night: boolean;
  onDone: (session: SessionUser) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setBusy(true);
    setError("");
    const task = fresh ? bootstrapAdmin({ name, email, password }) : loginAdmin(email, password);
    void task
      .then(onDone)
      .catch((reason: unknown) => setError(errorText(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className={night ? "adm night" : "adm"}>
      <div className="adm-login">
        <p className="adm-kicker">छिपा प्रवेश</p>
        <h1>{fresh ? "पहला सुपर एडमिन" : "एडमिन लॉगिन"}</h1>
        <p className="adm-note">पासवर्ड ऐप में लिखा नहीं है। सात टैप सिर्फ़ यह पर्दा खोलते हैं, अनुमति नहीं देते।</p>
        <Banner text={error} />
        {fresh ? (
          <label className="adm-field">
            <span>नाम</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label className="adm-field">
          <span>ईमेल</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" inputMode="email" />
        </label>
        <label className="adm-field">
          <span>पासवर्ड</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={fresh ? "new-password" : "current-password"}
          />
        </label>
        <button className="adm-primary" type="button" disabled={busy} onClick={submit}>
          {busy ? "जाँच हो रही है…" : fresh ? "एडमिन बनाएँ" : "लॉग इन"}
        </button>
        <button className="adm-quiet" type="button" onClick={onClose}>
          यूज़र ऐप पर वापस
        </button>
      </div>
    </div>
  );
}

const RANGES = [
  { id: "today", label: "आज" },
  { id: "yesterday", label: "कल" },
  { id: "7", label: "7 दिन" },
  { id: "30", label: "30 दिन" },
  { id: "90", label: "90 दिन" },
  { id: "custom", label: "तिथि" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

function rangeBounds(range: RangeId, from: string, to: string): [number, number] {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === "today") return [startToday, Date.now()];
  if (range === "yesterday") return [startToday - 86400000, startToday - 1];
  if (range === "7") return [Date.now() - 7 * 86400000, Date.now()];
  if (range === "30") return [Date.now() - 30 * 86400000, Date.now()];
  if (range === "90") return [Date.now() - 90 * 86400000, Date.now()];
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59`).getTime();
  return [Number.isNaN(start) ? 0 : start, Number.isNaN(end) ? Date.now() : end];
}

function Dashboard({ analytics }: { analytics: boolean }) {
  const rev = useAdminRev();
  const granths = useGranth((state) => state.granths);
  const topics = useGranth((state) => state.topics);
  const pramans = useGranth((state) => state.pramans);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [mail, setMail] = useState<FeedbackItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [version, setVersion] = useState(0);
  const [range, setRange] = useState<RangeId>("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    void listEvents().then(setEvents);
    void listFeedback()
      .then(setMail)
      .catch(() => setMail([]));
    void listDrafts().then(setDrafts);
    void contentVersion().then(setVersion);
  }, [rev]);

  const [start, end] = rangeBounds(range, from, to);
  const picked = events.filter((event) => event.at >= start && event.at <= end);
  const count = (type: string) => picked.filter((event) => event.type === type).length;
  const devices = new Set(picked.map((event) => event.device)).size;
  const pending = mail.filter((item) => item.status === "pending" || item.status === "review" || item.status === "info");
  const requests = pending.filter((item) => item.mode === "request");

  const chart = useMemo(() => {
    const days: Array<{ day: string; opens: number; pdf: number }> = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({
        day: key.slice(8),
        opens: events.filter((event) => event.day === key && event.type === "app_open").length,
        pdf: events.filter((event) => event.day === key && event.type === "pdf_download").length,
      });
    }
    return days;
  }, [events]);

  const recent = [...granths]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);
  const updated = drafts
    .filter((draft) => draft.touched)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  const top = (type: string) => {
    const map = new Map<string, number>();
    for (const event of picked.filter((item) => item.type === type)) {
      const key = event.label || event.entityId || "—";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  return (
    <section className="adm-stack">
      <h2>{analytics ? "आँकड़े" : "डेस्क"}</h2>
      <div className="adm-chips">
        {RANGES.map((item) => (
          <button key={item.id} type="button" className={range === item.id ? "on" : ""} onClick={() => setRange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="adm-split">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="से" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="तक" />
        </div>
      ) : null}
      <div className="adm-metrics">
        <Metric label="ग्रंथ" value={granths.length} />
        <Metric label="विषय" value={topics.length} />
        <Metric label="प्रमाण" value={pramans.length} />
        <Metric label="ऐप खुलना" value={count("app_open")} />
        <Metric label="PDF डाउनलोड" value={count("pdf_download")} />
        <Metric label="डिवाइस" value={devices} />
        <Metric label="लंबित पत्र" value={pending.length} />
        <Metric label="अनुरोध" value={requests.length} />
      </div>
      <article className="adm-card">
        <h3>14 दिन · खुलना और PDF</h3>
        <div className="adm-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart}>
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={11} />
              <YAxis allowDecimals={false} width={28} stroke="var(--color-muted)" fontSize={11} />
              <Tooltip />
              <Bar dataKey="opens" fill="var(--color-maroon)" radius={4} name="खुलना" />
              <Bar dataKey="pdf" fill="var(--color-saffron)" radius={4} name="PDF" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <div className="adm-split">
        <article className="adm-card">
          <h3>हाल में जोड़े</h3>
          {recent.length === 0 ? <p className="adm-muted">अभी कुछ नहीं।</p> : null}
          {recent.map((item) => (
            <p key={item.id}>{item.title}</p>
          ))}
        </article>
        <article className="adm-card">
          <h3>हाल में बदले</h3>
          {updated.length === 0 ? <p className="adm-muted">स्थानीय बदलाव अभी नहीं। संस्करण {version}</p> : null}
          {updated.map((item) => (
            <p key={item.id}>
              {item.title || item.name} · {when(item.updatedAt)}
            </p>
          ))}
        </article>
      </div>
      {analytics ? (
        <div className="adm-stack">
          <Table title="सबसे अधिक खोले गए ग्रंथ" rows={top("granth_open")} />
          <Table title="विषय" rows={top("topic_open")} />
          <Table title="प्रमाण" rows={top("praman_open")} />
          <Table title="खोज" rows={top("search")} />
          <Table title="खोज, कोई परिणाम नहीं" rows={top("search_empty")} />
          <Table title="PDF" rows={top("pdf_download")} />
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="adm-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function Table({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <article className="adm-card">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="adm-muted">इस अवधि में घटना नहीं।</p> : null}
      {rows.map(([label, value]) => (
        <p key={label} className="adm-line">
          <span>{label}</span>
          <strong>{value}</strong>
        </p>
      ))}
    </article>
  );
}
