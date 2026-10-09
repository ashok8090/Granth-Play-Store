import type { Role } from "./admin-model";

export class AdminError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const RANK: Record<Role, number> = {
  USER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function canContent(role: Role): boolean {
  return RANK[role] >= RANK.EDITOR;
}

export function canFeedback(role: Role): boolean {
  return RANK[role] >= RANK.ADMIN;
}

export function canUsers(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canSettings(role: Role): boolean {
  return RANK[role] >= RANK.ADMIN;
}

export function assertCanAssign(actor: Role, next: Role): void {
  if (!canUsers(actor)) {
    throw new AdminError("FORBIDDEN", "आप सदस्य नहीं बदल सकते।");
  }
  if (next === "SUPER_ADMIN") {
    throw new AdminError("FORBIDDEN", "सुपर एडमिन भूमिका यहाँ से नहीं बनती।");
  }
  if (actor === "ADMIN" && next === "ADMIN") {
    throw new AdminError("FORBIDDEN", "एडमिन दूसरे एडमिन नहीं बना सकता।");
  }
}

export function assertContent(role: Role): void {
  if (!canContent(role)) throw new AdminError("FORBIDDEN", "इस खाते को सामग्री बदलने की अनुमति नहीं है।");
}

export function assertFeedback(role: Role): void {
  if (!canFeedback(role)) throw new AdminError("FORBIDDEN", "प्रतिक्रिया सिर्फ़ एडमिन देख और बदल सकता है।");
}
