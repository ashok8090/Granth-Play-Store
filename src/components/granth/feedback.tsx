import { useState } from "react";
import { submitFeedback } from "@/lib/granth/admin-db";
import type { RequestType } from "@/lib/granth/admin-model";
import { useGranth } from "@/lib/granth/store";
import { Banner, errorText, Field } from "../admin/kit";

const REQUESTS: Array<{ id: RequestType; label: string }> = [
  { id: "add_granth", label: "ग्रंथ जोड़ें" },
  { id: "add_praman", label: "प्रमाण जोड़ें" },
  { id: "add_topic", label: "विषय जोड़ें" },
  { id: "add_pdf", label: "PDF जोड़ें" },
  { id: "incorrect", label: "गलत सामग्री" },
  { id: "missing_page", label: "पृष्ठ नहीं है" },
  { id: "other", label: "अन्य" },
];

export function FeedbackScreen() {
  const granths = useGranth((state) => state.granths);
  const topics = useGranth((state) => state.topics);
  const [mode, setMode] = useState<"general" | "request">("general");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("add_granth");
  const [granthId, setGranthId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = () => {
    setBusy(true);
    setError("");
    void submitFeedback({ mode, requestType, name, mobile, description, granthId, topicId, file })
      .then(() => {
        setDone(true);
        setDescription("");
        setFile(null);
      })
      .catch((reason: unknown) => setError(errorText(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <section className="adm-user-feedback">
      <header className="page-header">
        <div className="page-title">
          <h2>प्रतिक्रिया</h2>
        </div>
        <p className="subtitle">सुझाव या नई सामग्री का अनुरोध। प्रकाशित सामग्री अपने आप नहीं बनती।</p>
      </header>
      <div className="adm-card">
        <div className="adm-chips">
          <button type="button" className={mode === "general" ? "on" : ""} onClick={() => setMode("general")}>
            सामान्य
          </button>
          <button type="button" className={mode === "request" ? "on" : ""} onClick={() => setMode("request")}>
            सामग्री अनुरोध
          </button>
        </div>
        {done ? <p className="adm-ok">भेज दिया। एडमिन देखेगा, फिर तय करेगा।</p> : null}
        <Banner text={error} />
        <Field label="नाम">
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </Field>
        <Field label="मोबाइल">
          <input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" autoComplete="tel" />
        </Field>
        {mode === "request" ? (
          <Field label="अनुरोध">
            <select value={requestType} onChange={(event) => setRequestType(event.target.value as RequestType)}>
              {REQUESTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="ग्रंथ">
          <select value={granthId} onChange={(event) => setGranthId(event.target.value)}>
            <option value="">कोई नहीं</option>
            {granths.map((granth) => (
              <option key={granth.id} value={granth.id}>
                {granth.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="विषय">
          <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">कोई नहीं</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="विवरण">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        </Field>
        <Field label="फ़ोटो या PDF, वैकल्पिक">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <button className="adm-primary" type="button" disabled={busy} onClick={send}>
          {busy ? "भेज रहे हैं…" : "भेजें"}
        </button>
      </div>
    </section>
  );
}
