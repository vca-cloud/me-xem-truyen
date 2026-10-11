"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// Quick on/off for one story setting from the admin list (PATCH /api/admin/stories/[id]).
export function StoryFlagSwitch({ storyId, checked, label, body, onMessage, offMessage }: {
  storyId: string; checked: boolean; label: string; body: (checked: boolean) => Record<string, unknown>; onMessage: string; offMessage: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(checked);
  const [pending, setPending] = useState(false);

  async function change(next: boolean) {
    setPending(true);
    setValue(next);
    try {
      const response = await fetch(`/api/admin/stories/${storyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(next)) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không lưu được.");
      toast.success(next ? onMessage : offMessage);
      router.refresh();
    } catch (error) {
      setValue(!next);
      toast.error(error instanceof Error ? error.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return <Switch checked={value} disabled={pending} onCheckedChange={change} aria-label={label} />;
}
