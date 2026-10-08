import Link from "next/link";
import { Eye } from "lucide-react";
import { PageHeading, TableCard } from "@/components/admin-ui";
import { StoryTag } from "@/components/home-page";
import { HotPinSwitch } from "@/components/hot-pin-switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getViewReport, type ViewReport } from "@/lib/analytics";
import { getViewStats } from "@/lib/stories";
import { HOT_MIN_VIEWS_7D, HOT_TOP } from "@/lib/views";

const periods = [7, 30, 90] as const;
const number = (value: number) => value.toLocaleString("vi-VN");
const shortDate = (date: string) => { const [, month, day] = date.split("-"); return `${day}/${month}`; };

function Kpi({ title, value, note }: { title: string; value: number; note: string }) {
  return <Card className="gap-1 py-4"><CardContent className="px-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(value)}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}

// Daily bars: views (blue) with unique readers (orange) inside; hover shows the exact numbers.
function ViewChart({ daily }: { daily: ViewReport["daily"] }) {
  const max = Math.max(...daily.map((day) => day.views), 0);
  if (max === 0) return <p className="py-16 text-center text-sm text-muted-foreground">Chưa có lượt xem trong khoảng này.</p>;
  const labels = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);
  return <div>
    <div className="flex h-60 items-end gap-px border-b border-l px-1">
      {daily.map((day) => <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${shortDate(day.date)}: ${number(day.views)} lượt xem · ${number(day.visitors)} người đọc`}>
        <div className="w-full rounded-t-sm bg-chart-2 transition-opacity group-hover:opacity-80" style={{ height: `${(day.views / max) * 100}%` }} />
        <div className="absolute bottom-0 w-1/3 rounded-t-sm bg-highlight" style={{ height: `${(day.visitors / max) * 100}%` }} />
      </div>)}
    </div>
    <div className="mt-1.5 flex justify-between px-1 text-xs text-muted-foreground">{daily.map((day, index) => labels.has(index) ? <span key={day.date}>{shortDate(day.date)}</span> : null)}</div>
    <div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-2" />Lượt xem</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-highlight" />Người đọc</span></div>
  </div>;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  return <div className="flex h-7 w-28 items-end gap-px" title={`14 ngày: ${values.map(number).join(", ")}`}>
    {values.map((value, index) => <div key={index} className="min-w-0 flex-1 rounded-t-[1px] bg-chart-2" style={{ height: max ? `${Math.max((value / max) * 100, value ? 8 : 2)}%` : "2%" }} />)}
  </div>;
}

export default async function ViewsPage({ searchParams }: PageProps<"/admin/luot-xem">) {
  const requested = Number((await searchParams).ngay);
  const days = periods.includes(requested as (typeof periods)[number]) ? requested : 30;
  const [{ data, error }, viewStats] = await Promise.all([getViewReport(days), getViewStats()]);
  const periodViews = data.daily.reduce((sum, day) => sum + day.views, 0);

  return <>
    <PageHeading title="Lượt xem" description="Số liệu thật từ hệ thống theo dõi: đã lọc bot, một người xem lại cùng trang trong 30 phút chỉ tính 1 lần. Ngày theo giờ Việt Nam." />
    {error && <Alert variant="destructive" className="mb-6"><AlertTitle>Không tải được số liệu lượt xem</AlertTitle><AlertDescription>{/admin_view_stats|function|schema cache/i.test(error) ? "Cần chạy file supabase/migrations/0009_views.sql trong Supabase SQL Editor." : error}</AlertDescription></Alert>}

    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi title="Tổng lượt xem" value={data.total} note="Từ trước tới nay" />
      <Kpi title="Tổng người đọc" value={data.visitors_total} note="Người đọc khác nhau, từ trước tới nay" />
      <Kpi title="Hôm nay" value={data.today} note="Lượt xem trong ngày" />
      <Kpi title="7 ngày" value={data.last7} note="Gồm hôm nay" />
      <Kpi title="30 ngày" value={data.last30} note="Gồm hôm nay" />
    </div>

    <Card className="mt-6">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Eye className="size-5 text-muted-foreground" />Lượt xem theo ngày · {number(periodViews)} lượt trong {days} ngày</CardTitle>
        <div className="flex gap-1">{periods.map((period) => <Button key={period} size="sm" variant={period === days ? "default" : "outline"} nativeButton={false} render={<Link href={`/admin/luot-xem?ngay=${period}`} scroll={false} />}>{period} ngày</Button>)}</div>
      </CardHeader>
      <CardContent><ViewChart daily={data.daily} /></CardContent>
    </Card>

    <div className="mt-6"><TableCard title="Lượt xem theo truyện">
      <p className="border-b px-5 py-3 text-xs text-muted-foreground">Tag HOT tự động: {HOT_TOP} truyện nhiều lượt xem nhất trong 7 ngày, tối thiểu {number(HOT_MIN_VIEWS_7D)} lượt. Bật “Ghim HOT” để luôn hiện HOT cho truyện bạn chọn.</p>
      <div className="overflow-x-auto"><Table className="min-w-[760px]">
        <TableHeader><TableRow><TableHead className="pl-5">Truyện</TableHead><TableHead className="text-right">Tổng</TableHead><TableHead className="text-right">30 ngày</TableHead><TableHead className="text-right">7 ngày</TableHead><TableHead className="text-right">Người đọc</TableHead><TableHead>14 ngày qua</TableHead><TableHead>HOT</TableHead><TableHead className="pr-5">Ghim HOT</TableHead></TableRow></TableHeader>
        <TableBody>{data.stories.map((story) => <TableRow key={story.id}>
          <TableCell className="max-w-72 pl-5"><Link href={`/truyen/${story.slug}`} target="_blank" className="block truncate font-medium hover:underline">{story.title}</Link></TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{number(story.total)}</TableCell>
          <TableCell className="text-right tabular-nums">{number(story.d30)}</TableCell>
          <TableCell className="text-right tabular-nums">{number(story.d7)}</TableCell>
          <TableCell className="text-right tabular-nums">{number(story.visitors)}</TableCell>
          <TableCell><Sparkline values={story.spark} /></TableCell>
          <TableCell>{viewStats.hot.has(story.id) ? <StoryTag tag="HOT" small /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
          <TableCell className="pr-5"><HotPinSwitch storyId={story.id} title={story.title} pinned={story.hot_pinned} /></TableCell>
        </TableRow>)}
        {data.stories.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Chưa có truyện.</TableCell></TableRow>}</TableBody>
      </Table></div>
    </TableCard></div>
  </>;
}
