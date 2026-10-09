import { useEffect, useState } from "react";
import { contentManifest, contentVersion, listFeedback, listLogs, listUsers, saveUser, updateFeedback } from "@/lib/granth/admin-db";
import type { ActivityLog, AdminUser, FeedbackItem, FeedbackStatus, Priority, RequestType, Role, SessionUser } from "@/lib/granth/admin-model";
import { canFeedback, canUsers } from "@/lib/granth/admin-roles";
import { Banner, errorText, Field, roleLabel, Sheet, useAdminRev, when } from "./kit";

const TABS: Array<{ id: "all" | FeedbackStatus; label: string }> = [
  { id: "all", label: "सभी" },
  { id: "pending", label: "लंबित" },
  { id: "review", label: "समीक्षा" },
  { id: "info", label: "और जानकारी" },
  { id: "progress", label: "चल रहा" },
  { id: "approved", label: "स्वीकृत" },
  { id: "rejected", label: "अस्वीकृत" },
  { id: "completed", label: "पूर्ण" },
];

const REQUEST_LABEL: Record<RequestType, string> = {
  add_granth: "ग्रंथ",
  add_praman: "प्रमाण",
  add_topic: "विषय",
  add_pdf: "PDF",
  incorrect: "गलत सामग्री",
  missing_page: "छूटा पृष्ठ",
  other: "अन्य",
};

export function InboxScreen({ role }: { role: Role }) {
  const rev = useAdminRev();
  const [rows, setRows] = useState<FeedbackItem[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const [mode, setMode] = useState<"all" | "general" | "request">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<FeedbackItem | null>(null);
  const [error, setError] = useState("");
  const manage = canFeedback(role);

  useEffect(() => {
    void listFeedback()
      .then(setRows)
      .catch((reason: unknown) => setError(errorText(reason)));
  }, [rev]);

  const shown = rows.filter((row) => {
    if (tab !== "all" && row.status !== tab) return false;
    if (mode !== "all" && row.mode !== mode) return false;
    const blob = `${row.name} ${row.mobile} ${row.description}`.toLowerCase();
    return blob.includes(query.trim().toLowerCase());
  });

  return (
    <section className="adm-stack">
      <h2>पत्र और अनुरोध</h2>
      <p className="adm-note">स्वीकृति अपने आप ग्रंथ नहीं बनाती। सामग्री अलग से लिखकर प्रकाशित करें।</p>
      <Banner text={error} />
      <input className="adm-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="नाम, नंबर या बात" aria-label="पत्र खोज" />
      <div className="adm-chips">
        <button type="button" className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>
          दोनों
        </button>
        <button type="button" className={mode === "general" ? "on" : ""} onClick={() => setMode("general")}>
          प्रतिक्रिया
        </button>
        <button type="button" className={mode === "request" ? "on" : ""} onClick={() => setMode("request")}>
          अनुरोध
        </button>
      </div>
      <div className="adm-chips">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="adm-muted">कोई पत्र नहीं।</p> : null}
      {shown.map((item) => (
        <article key={item.id} className="adm-card">
          <div className="adm-head">
            <h3>{item.name}</h3>
            <span className="adm-pill">{labelStatus(item.status)}</span>
          </div>
          <p>{item.description}</p>
          <p className="adm-muted">
            {item.mode === "request" && item.requestType ? REQUEST_LABEL[item.requestType] : "सामान्य"} · {item.mobile} · {when(item.createdAt)}
          </p>
          <button type="button" onClick={() => setOpen(item)}>
            खोलें
          </button>
        </article>
      ))}
      {open ? (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <p>{open.description}</p>
          {open.attachmentName ? (
            <p className="adm-muted">
              संलग्नक {open.attachmentName} · {open.attachmentMime} · {open.attachmentSize} बाइट · मूल फ़ाइल नहीं बदली गई
            </p>
          ) : null}
          <Field label="आंतरिक नोट">
            <textarea rows={3} value={open.note} onChange={(event) => setOpen({ ...open, note: event.target.value })} disabled={!manage} />
          </Field>
          <Field label="प्राथमिकता">
            <select
              value={open.priority}
              disabled={!manage}
              onChange={(event) => setOpen({ ...open, priority: event.target.value as Priority })}
            >
              <option value="low">कम</option>
              <option value="normal">सामान्य</option>
              <option value="high">ऊँची</option>
            </select>
          </Field>
          {manage ? (
            <div className="adm-actions">
              {(["review", "info", "progress", "approved", "rejected", "completed"] as FeedbackStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    void updateFeedback(open.id, { status, priority: open.priority, note: open.note })
                      .then(() => setOpen(null))
                      .catch((reason: unknown) => setError(errorText(reason)));
                  }}
                >
                  {labelStatus(status)}
                </button>
              ))}
            </div>
          ) : (
            <p className="adm-muted">संपादक पत्र पढ़ सकता है, स्थिति नहीं बदल सकता।</p>
          )}
        </Sheet>
      ) : null}
    </section>
  );
}

function labelStatus(status: FeedbackStatus | "all"): string {
  return TABS.find((tab) => tab.id === status)?.label ?? status;
}

export function PeopleScreen({ actor }: { actor: SessionUser["user"] }) {
  const rev = useAdminRev();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", email: "", password: "", role: "EDITOR" as Role, active: true });

  useEffect(() => {
    if (!canUsers(actor.role)) return;
    void listUsers()
      .then(setUsers)
      .catch((reason: unknown) => setError(errorText(reason)));
  }, [actor.role, rev]);

  if (!canUsers(actor.role)) return <p className="adm-muted">सदस्य सिर्फ़ एडमिन देखता है।</p>;

  const roles: Role[] = actor.role === "SUPER_ADMIN" ? ["ADMIN", "EDITOR", "USER"] : ["EDITOR", "USER"];

  return (
    <section className="adm-stack">
      <div className="adm-head">
        <h2>सदस्य</h2>
        <button
          className="adm-primary"
          type="button"
          onClick={() => {
            setForm({ id: "", name: "", email: "", password: "", role: "EDITOR", active: true });
            setOpen(true);
          }}
        >
          नया
        </button>
      </div>
      <Banner text={error} />
      {users.map((user) => (
        <article key={user.id} className="adm-card">
          <h3>{user.name}</h3>
          <p className="adm-muted">
            {user.email} · {roleLabel(user.role)} · {user.active ? "सक्रिय" : "बंद"}
          </p>
          <button
            type="button"
            onClick={() => {
              setForm({ id: user.id, name: user.name, email: user.email, password: "", role: user.role, active: user.active });
              setOpen(true);
            }}
          >
            संपादन
          </button>
        </article>
      ))}
      {open ? (
        <Sheet title={form.id ? "सदस्य" : "नया सदस्य"} onClose={() => setOpen(false)}>
          <Field label="नाम">
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="ईमेल">
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label={form.id ? "नया पासवर्ड, खाली छोड़ सकते हैं" : "पासवर्ड"}>
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </Field>
          <Field label="भूमिका">
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} disabled={form.role === "SUPER_ADMIN"}>
              {form.role === "SUPER_ADMIN" ? <option value="SUPER_ADMIN">सुपर एडमिन</option> : null}
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </Field>
          <label className="adm-check">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> सक्रिय
          </label>
          <button
            className="adm-primary"
            type="button"
            onClick={() => {
              void saveUser({ ...form, password: form.password || undefined })
                .then(() => setOpen(false))
                .catch((reason: unknown) => setError(errorText(reason)));
            }}
          >
            सेव
          </button>
        </Sheet>
      ) : null}
    </section>
  );
}

export function LogsScreen() {
  const rev = useAdminRev();
  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    void listLogs()
      .then(setRows)
      .catch((reason: unknown) => setError(errorText(reason)));
  }, [rev]);
  const shown = rows.filter((row) => `${row.action} ${row.userName} ${row.meta}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="adm-stack">
      <h2>गतिविधि</h2>
      <Banner text={error} />
      <input className="adm-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="कार्य या नाम" aria-label="लॉग खोज" />
      {shown.map((row) => (
        <article key={row.id} className="adm-card">
          <h3>{row.action}</h3>
          <p className="adm-muted">
            {row.userName} · {row.entity} · {when(row.at)}
          </p>
          {row.meta ? <p>{row.meta}</p> : null}
        </article>
      ))}
    </section>
  );
}

export function SettingsScreen({ role }: { role: Role }) {
  const rev = useAdminRev();
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState<Array<{ id: string; version: number; updatedAt: number; size: number; mime: string }>>([]);
  useEffect(() => {
    void contentVersion().then(setVersion);
    void contentManifest().then(setRows);
  }, [rev]);
  return (
    <section className="adm-stack">
      <h2>सेटिंग</h2>
      <article className="adm-card">
        <h3>सामग्री संस्करण {version}</h3>
        <p className="adm-note">
          प्रकाशित बदलाव इस ऐप की सूची में तुरंत जुड़ते हैं। आपके मौजूदा PHP सर्वर पर वही लिखने के लिए एडमिन API उसी MySQL पर लगती है। पुरानी सार्वजनिक सूची वैसे ही चलती रहती है।
        </p>
        {role === "EDITOR" ? <p className="adm-muted">सेटिंग बदलना एडमिन का काम है।</p> : null}
      </article>
      <article className="adm-card">
        <h3>सिंक सूची</h3>
        <p className="adm-muted">सिर्फ़ बदली हुई फ़ाइल। पूरी लाइब्रेरी दोबारा नहीं उतरती।</p>
        {rows.length === 0 ? <p className="adm-muted">अभी कोई नई फ़ाइल नहीं।</p> : null}
        {rows.map((row) => (
          <p key={row.id} className="adm-line">
            <span>
              {row.id.slice(0, 12)} · v{row.version}
            </span>
            <strong>
              {row.mime || "—"} · {row.size}
            </strong>
          </p>
        ))}
      </article>
    </section>
  );
}
