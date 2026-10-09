import { X } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { adminRevision, subscribeAdmin } from "@/lib/granth/admin-db";
import { AdminError } from "@/lib/granth/admin-roles";
import type { Role } from "@/lib/granth/admin-model";

export function useAdminRev(): number {
  return useSyncExternalStore(subscribeAdmin, adminRevision, () => 0);
}

export function errorText(error: unknown): string {
  if (error instanceof AdminError) return error.message;
  return "काम पूरा नहीं हुआ। फिर कोशिश करें।";
}

export function roleLabel(role: Role): string {
  if (role === "SUPER_ADMIN") return "सुपर एडमिन";
  if (role === "ADMIN") return "एडमिन";
  if (role === "EDITOR") return "संपादक";
  return "सदस्य";
}

export function when(stamp: number): string {
  return new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(stamp);
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="adm-sheet" role="presentation" onClick={onClose}>
      <div
        className="adm-sheet-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="adm-sheet-bar">
          <h3>{title}</h3>
          <button type="button" className="adm-icon" onClick={onClose} aria-label="बंद करें">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Banner({ text }: { text: string }) {
  if (!text) return null;
  return <p className="adm-banner">{text}</p>;
}
