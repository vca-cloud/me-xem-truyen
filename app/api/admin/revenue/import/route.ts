import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRevenueCsv } from "@/lib/revenue-import";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Upserts Shopee conversion reports (by order_id) or AdSense daily reports (by date + ad_unit).
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const type = formData.get("type");
    const file = formData.get("file");
    if (type !== "shopee" && type !== "adsense") return NextResponse.json({ error: "Loại báo cáo không hợp lệ." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn file CSV." }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "File import không được vượt quá 5 MB." }, { status: 413 });

    const supabase = await createClient();
    const text = await file.text();
    if (type === "shopee") {
      const parsed = parseRevenueCsv("shopee", text);
      if (parsed.errors.length) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
      if (!parsed.rows.length) return NextResponse.json({ error: "File không có dòng dữ liệu hợp lệ." }, { status: 400 });
      const { data: links } = await supabase.from("affiliate_links").select("id, sub_id").not("sub_id", "is", null);
      const linkBySubId = new Map((links ?? []).map((link) => [link.sub_id as string, link.id as string]));
      const { error } = await supabase.from("affiliate_conversions").upsert(
        parsed.rows.map((row) => ({ ...row, link_id: row.sub_id ? linkBySubId.get(row.sub_id) ?? null : null, imported_at: new Date().toISOString() })),
        { onConflict: "order_id" },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const unmatched = parsed.rows.filter((row) => !row.sub_id || !linkBySubId.has(row.sub_id)).length;
      return NextResponse.json({ imported: parsed.rows.length, unmatched });
    }

    const parsed = parseRevenueCsv("adsense", text);
    if (parsed.errors.length) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    if (!parsed.rows.length) return NextResponse.json({ error: "File không có dòng dữ liệu hợp lệ." }, { status: 400 });
    const { error } = await supabase.from("adsense_daily").upsert(
      parsed.rows.map((row) => ({ ...row, synced_at: new Date().toISOString() })),
      { onConflict: "date,ad_unit" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ imported: parsed.rows.length, unmatched: 0 });
  } catch {
    return NextResponse.json({ error: "Bạn không có quyền hoặc máy chủ chưa sẵn sàng." }, { status: 500 });
  }
}
