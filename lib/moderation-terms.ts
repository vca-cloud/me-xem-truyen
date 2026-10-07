// Validation for admin dictionary edits (shared by the moderation-terms API routes).
const categories = ["violence", "self_harm", "sexual", "drugs", "hate", "profanity"];
const masks = ["stars", "dots", "none"];

export function parseTerm(body: Record<string, unknown>) {
  const term = typeof body.term === "string" ? body.term.normalize("NFC").trim() : "";
  const severity = Number(body.severity);
  if (!term || term.length > 80) return { error: "Từ/cụm từ từ 1 đến 80 ký tự." };
  if (!categories.includes(String(body.category))) return { error: "Nhóm không hợp lệ." };
  if (![1, 2, 3].includes(severity)) return { error: "Mức độ phải là 1, 2 hoặc 3." };
  if (!masks.includes(String(body.mask_style))) return { error: "Kiểu che không hợp lệ." };
  return { value: { term, category: String(body.category), severity, mask_style: String(body.mask_style), active: body.active !== false } };
}
