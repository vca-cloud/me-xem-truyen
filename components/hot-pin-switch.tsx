"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// Admin toggle that pins a story as HOT by hand (the automatic HOT rule still applies on top).
export function HotPinSwitch({ storyId, title, pinned }: { storyId: string; title: string; pinned: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(pinned);
  const [pending, setPending] = useState(false);

  async function change(next: boolean) {
    setPending(true);
    setValue(next);
    try {
      const response = await fetch(`/api/admin/stories/${storyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hot_pinned: next }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Không lưu được.");
      toast.success(next ? `Đã ghim HOT: ${title}` : `Đã bỏ ghim HOT: ${title}`);
      router.refresh();
    } catch (error) {
      setValue(!next);
      toast.error(error instanceof Error ? error.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return <Switch checked={value} disabled={pending} onCheckedChange={change} aria-label={`Ghim HOT cho ${title}`} />;
}
