"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Search } from "lucide-react";
import type { HeaderGenre } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchHref, sortOptions, type GenreMode, type SearchSort, type SearchState } from "@/lib/search";
import { cn } from "@/lib/utils";

const modeOptions = [{ value: "tat-ca", label: "Có tất cả thể loại đã chọn" }, { value: "mot-trong", label: "Có ít nhất một thể loại" }];
const statusOptions = [{ value: "all", label: "Mọi trạng thái" }, { value: "Đang ra", label: "Đang ra" }, { value: "Hoàn thành", label: "Hoàn thành" }, { value: "Tạm dừng", label: "Tạm dừng" }];

// Advanced search form: keyword, several genres (all / any), status and sort. Applies by navigating to the URL.
export function SearchFilters({ catalog, initial }: { catalog: HeaderGenre[]; initial: SearchState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const update = (patch: Partial<SearchState>) => setState((current) => ({ ...current, ...patch }));
  const toggle = (slug: string) => update({ genres: state.genres.includes(slug) ? state.genres.filter((item) => item !== slug) : [...state.genres, slug] });

  function apply(event: React.FormEvent) {
    event.preventDefault();
    router.push(searchHref(state));
  }

  return <Card className="p-4 sm:p-5">
    <form onSubmit={apply} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <Field><FieldLabel htmlFor="s-q">Từ khóa</FieldLabel><Input id="s-q" value={state.q} onChange={(event) => update({ q: event.target.value })} placeholder="Tên truyện, tác giả, thể loại..." /></Field>
        <Field><FieldLabel>Trạng thái</FieldLabel><Select items={statusOptions} value={state.status || "all"} onValueChange={(value) => update({ status: !value || value === "all" ? "" : String(value) })}><SelectTrigger className="w-full" aria-label="Trạng thái"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field><FieldLabel>Sắp xếp</FieldLabel><Select items={sortOptions} value={state.sort} onValueChange={(value) => update({ sort: value as SearchSort })}><SelectTrigger className="w-full" aria-label="Sắp xếp"><SelectValue /></SelectTrigger><SelectContent>{sortOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Thể loại {state.genres.length > 0 && <span className="text-muted-foreground">(đã chọn {state.genres.length})</span>}</p>
          {state.genres.length > 1 && <Select items={modeOptions} value={state.mode} onValueChange={(value) => update({ mode: value as GenreMode })}><SelectTrigger size="sm" className="w-60" aria-label="Cách lọc thể loại"><SelectValue /></SelectTrigger><SelectContent>{modeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>}
        </div>
        {catalog.length ? <div className="flex flex-wrap gap-2">{catalog.map((genre) => {
          const active = state.genres.includes(genre.slug);
          return <button key={genre.slug} type="button" aria-pressed={active} onClick={() => toggle(genre.slug)} className={cn("inline-flex max-w-[12rem] items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors", active ? "border-highlight bg-highlight text-highlight-foreground" : "bg-background hover:border-highlight/60 hover:bg-muted")}>{active && <Check className="size-3.5 shrink-0" />}<span className="truncate">{genre.name}</span></button>;
        })}</div> : <p className="text-sm text-muted-foreground">Chưa có thể loại nào.</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { setState({ q: "", genres: [], mode: "tat-ca", status: "", sort: "cap-nhat" }); router.push("/tim-kiem"); }}><RotateCcw />Xóa bộ lọc</Button>
        <Button type="submit" className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><Search />Tìm truyện</Button>
      </div>
    </form>
  </Card>;
}
