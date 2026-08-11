import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "./storage";

const ONBOARD = new Set(["training_admin", "director"]);
const INTERNAL = new Set([
  "director",
  "deployment_coordinator",
  "lead_auditor",
  "auditor",
  "training_admin",
  "qehs_consultant",
  "finance",
]);

export function canUploadDocument(role: string): boolean {
  return ONBOARD.has(role);
}

/** Scope check: internal staff may view; a deployed officer only their own. */
export function canAccessDocument(user: { role: string; personId: string | null }, certPersonId: string): boolean {
  return INTERNAL.has(user.role) || (user.role === "deployed_officer" && user.personId === certPersonId);
}

/** Server-side validation — never trust the client. Returns an error string or null. */
export function validateDocument(contentType: string, sizeBytes: number): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(contentType)) return "Only PDF, PNG or JPEG documents are accepted.";
  if (sizeBytes > MAX_DOCUMENT_BYTES) return "Document exceeds the 5 MB limit.";
  return null;
}
