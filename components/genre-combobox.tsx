"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from "@/components/ui/combobox";

const CREATE_PREFIX = "\u0000create:";

// Multi-select of genres from the catalog. Typing a name that does not exist offers "Thêm thể loại …",
// which creates it through the admin API and selects it.
export function GenreCombobox({ catalog, value, onChange, onCreated, id }: { catalog: string[]; value: string[]; onChange: (genres: string[]) => void; onCreated: (name: string) => void; id?: string }) {
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const trimmed = query.trim();
  const items = useMemo(() => {
    const all = [...new Set([...catalog, ...value])].sort((a, b) => a.localeCompare(b, "vi"));
    const exists = all.some((name) => name.toLocaleLowerCase("vi") === trimmed.toLocaleLowerCase("vi"));
    return trimmed && !exists ? [...all, CREATE_PREFIX + trimmed] : all;
  }, [catalog, value, trimmed]);

  async function create(name: string) {
    setPending(true);
    try {
      const response = await fetch("/api/admin/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { toast.error(body.error ?? "Không thể tạo thể loại."); return false; }
      onCreated(name);
      toast.success(`Đã thêm thể loại "${name}".`);
      return true;
    } catch {
      toast.error("Lỗi kết nối đến server.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleChange(next: string[]) {
    const createItem = next.find((item) => item.startsWith(CREATE_PREFIX));
    if (!createItem) return onChange(next);
    const name = createItem.slice(CREATE_PREFIX.length);
    const kept = next.filter((item) => item !== createItem);
    if (await create(name)) { onChange([...kept, name]); setQuery(""); }
  }

  return <Combobox multiple autoHighlight items={items} value={value} onValueChange={(next) => handleChange(next as string[])} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={(item: string) => item.startsWith(CREATE_PREFIX) ? item.slice(CREATE_PREFIX.length) : item}>
    <ComboboxChips ref={anchor} className="w-full">
      <ComboboxValue>
        {(values: string[]) => <Fragment>
          {values.map((name) => <ComboboxChip key={name}>{name}</ComboboxChip>)}
          <ComboboxChipsInput id={id} placeholder={values.length ? "" : "Gõ để tìm hoặc thêm thể loại..."} disabled={pending} />
        </Fragment>}
      </ComboboxValue>
    </ComboboxChips>
    <ComboboxContent anchor={anchor}>
      <ComboboxEmpty>Gõ tên để thêm thể loại mới.</ComboboxEmpty>
      <ComboboxList>
        {(item: string) => <ComboboxItem key={item} value={item}>
          {item.startsWith(CREATE_PREFIX) ? <span className="font-medium text-primary">+ Thêm thể loại “{item.slice(CREATE_PREFIX.length)}”</span> : item}
        </ComboboxItem>}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>;
}
