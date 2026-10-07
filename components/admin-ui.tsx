import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    {action}
  </div>;
}

const positive = new Set(["Hoạt động", "Đang ra", "Đang bật", "Hoàn thành"]);
const negative = new Set(["Bị khóa", "Tạm dừng", "Đã tắt"]);

// Status label as a shadcn Badge: green for active states, red for paused/locked, neutral otherwise.
export function StatusBadge({ children }: { children: React.ReactNode }) {
  const value = String(children);
  if (positive.has(value)) return <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">{children}</Badge>;
  if (negative.has(value)) return <Badge variant="destructive">{children}</Badge>;
  return <Badge variant="secondary">{children}</Badge>;
}

export function TableCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <Card className="gap-0 py-0">
    <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4"><CardTitle>{title}</CardTitle>{action && <CardAction>{action}</CardAction>}</CardHeader>
    <CardContent className="px-0">{children}</CardContent>
  </Card>;
}
