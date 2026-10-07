// Moderation engine (pure, no I/O): finds dictionary terms in Vietnamese text, scores a chapter and masks words.
// Matching is case-insensitive on NFC text, respects word boundaries and also catches spelled-out variants
// such as "c.h.ế.t" or "đ-ụ" (letters separated by . - _ * ·).

export type ModerationCategory = "violence" | "self_harm" | "sexual" | "drugs" | "hate" | "profanity";
export type MaskStyle = "stars" | "dots" | "none";
export type ModerationTerm = { term: string; category: ModerationCategory; severity: number; mask_style: MaskStyle };
export type ModerationHit = { term: string; category: ModerationCategory; severity: number; count: number; sample: string };
export type ModerationResult = { score: number; maxSeverity: number; hits: ModerationHit[]; mature: boolean };

export const categoryLabels: Record<ModerationCategory, string> = {
  violence: "Bạo lực",
  self_harm: "Tự hại",
  sexual: "Tình dục",
  drugs: "Chất cấm",
  hate: "Miệt thị",
  profanity: "Chửi thề",
};

export const severityLabels: Record<number, string> = { 1: "Nhẹ (chỉ che chữ)", 2: "Nặng (tắt QC, chờ duyệt)", 3: "Rất nặng (tắt QC, chờ duyệt)" };

// Number of severity-3 sexual matches from which a chapter is labelled 18+ (admin-only label).
export const MATURE_THRESHOLD = 2;

const SEPARATORS = "[.\\-_*·]{0,2}";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CompiledTerm = ModerationTerm & { pattern: RegExp };

export function compileTerms(terms: ModerationTerm[]): CompiledTerm[] {
  return terms
    .map((term) => ({ ...term, term: term.term.normalize("NFC").trim() }))
    .filter((term) => term.term)
    // Longer phrases first, so "giết người" is handled before "giết".
    .sort((a, b) => b.term.length - a.term.length)
    .map((term) => {
      const body = [...term.term.toLocaleLowerCase("vi")].map((char) => (/\s/.test(char) ? "\\s+" : escape(char) + SEPARATORS)).join("");
      return { ...term, pattern: new RegExp(`(?<![\\p{L}\\p{N}])${body.replace(new RegExp(`${escape(SEPARATORS)}$`), "")}(?![\\p{L}\\p{N}])`, "giu") };
    });
}

function snippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

export function scanText(input: string, terms: CompiledTerm[]): ModerationResult {
  const text = input.normalize("NFC");
  const hits: ModerationHit[] = [];
  for (const term of terms) {
    term.pattern.lastIndex = 0;
    let count = 0;
    let sample = "";
    for (const match of text.matchAll(term.pattern)) {
      if (!count) sample = snippet(text, match.index ?? 0, match[0].length);
      count += 1;
    }
    if (count) hits.push({ term: term.term, category: term.category, severity: term.severity, count, sample });
  }
  hits.sort((a, b) => b.severity - a.severity || b.count - a.count);
  const maxSeverity = hits.reduce((max, hit) => Math.max(max, hit.severity), 0);
  const score = hits.reduce((sum, hit) => sum + hit.count * hit.severity * hit.severity, 0);
  const sexualSevere = hits.filter((hit) => hit.category === "sexual" && hit.severity >= 3).reduce((sum, hit) => sum + hit.count, 0);
  return { score, maxSeverity, hits: hits.slice(0, 50), mature: sexualSevere >= MATURE_THRESHOLD };
}

// Default publishing decision: ads on unless something at severity 2+ was found, which then waits for review.
export function moderationDecision(result: ModerationResult) {
  const flagged = result.maxSeverity >= 2;
  return { moderation_status: flagged ? "pending" : "clean", ads_enabled: !flagged, is_mature: result.mature } as const;
}

function maskWord(word: string, style: MaskStyle) {
  if (style === "none") return word;
  if (style === "dots") return word.split(/\s+/).map((part) => [...part.replace(/[.\-_*·]/g, "")].join(".")).join(" ");
  // stars: keep the first letter of each syllable ("địt mẹ" → "đ** m*").
  return word.split(/\s+/).map((part) => {
    const letters = [...part.replace(/[.\-_*·]/g, "")];
    return letters[0] + "*".repeat(Math.max(letters.length - 1, 2));
  }).join(" ");
}

export function maskText(input: string, terms: CompiledTerm[]) {
  let text = input.normalize("NFC");
  for (const term of terms) {
    if (term.mask_style === "none") continue;
    term.pattern.lastIndex = 0;
    text = text.replace(term.pattern, (match) => maskWord(match, term.mask_style));
  }
  return text;
}
