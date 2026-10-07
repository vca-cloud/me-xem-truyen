"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { categoryLabels, type ModerationCategory } from "@/lib/moderation-core";

export type ModerationHitSummary = { term: string; category: string; severity: number; count: number; sample?: string };

const statusLabels: Record<string, { label: string; variant: "secondary" | "destructive" | "outline" | "default" }> = {
  unscanned: { label: "Chưa quét", variant: "outline" },
  clean: { label: "Sạch", variant: "secondary" },
  pending: { label: "Chờ duyệt", variant: "destructive" },
  approved: { label: "Đã duyệt", variant: "default" },
};

export function ModerationStatusBadge({ status }: { status: string }) {
  const item = statusLabels[status] ?? statusLabels.unscanned;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

// 18+ is an internal label: shown in admin only, never on public pages.
export function MatureBadge() {
  return <Badge variant="destructive" className="font-bold">18+</Badge>;
}

// Small "n từ" badge; hover lists the matched dictionary words by category and severity.
export function HitsBadge({ hits }: { hits: ModerationHitSummary[] }) {
  if (!hits?.length) return null;
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  return <Tooltip>
    <TooltipTrigger render={<span className="cursor-help" />}><Badge variant="outline">{total} từ</Badge></TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <ul className="space-y-0.5 text-xs">{hits.slice(0, 8).map((hit) => <li key={hit.term}>“{hit.term}” ×{hit.count} · {categoryLabels[hit.category as ModerationCategory] ?? hit.category} · mức {hit.severity}</li>)}</ul>
    </TooltipContent>
  </Tooltip>;
}
