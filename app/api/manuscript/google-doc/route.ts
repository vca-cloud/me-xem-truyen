import { NextResponse, type NextRequest } from "next/server";
import { guardAdminApi, roleAccess } from "@/lib/auth";
import { guardAuthorApi } from "@/lib/authors";

const MAX_BYTES = 4_000_000; // Vercel caps a function response at 4.5 MB; larger documents: download .docx and upload it.
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Fetches a Google Docs document shared as "anyone with the link" as .docx, for the manuscript uploader.
// Only the document id is taken from the pasted link, and only docs.google.com is ever requested.
export async function GET(request: NextRequest) {
  const admin = await guardAdminApi(roleAccess.content);
  if (admin.error) {
    const author = await guardAuthorApi();
    if (author.error) return author.error;
  }
  const link = request.nextUrl.searchParams.get("url") ?? "";
  const id = link.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/)?.[1];
  if (!id) return NextResponse.json({ error: "Link không phải tài liệu Google Docs (dạng docs.google.com/document/d/…)." }, { status: 400 });
  try {
    const response = await fetch(`https://docs.google.com/document/d/${id}/export?format=docx`, { redirect: "follow", signal: AbortSignal.timeout(30_000), cache: "no-store" });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes(DOCX)) return NextResponse.json({ error: "Không đọc được tài liệu. Hãy bật chia sẻ “Bất kỳ ai có đường liên kết đều xem được”, hoặc tải file .docx về rồi tải lên." }, { status: 400 });
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return NextResponse.json({ error: "Tài liệu quá lớn để lấy qua link. Trong Google Docs chọn Tệp → Tải xuống → Microsoft Word (.docx) rồi tải file lên." }, { status: 413 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "Tài liệu quá lớn để lấy qua link. Trong Google Docs chọn Tệp → Tải xuống → Microsoft Word (.docx) rồi tải file lên." }, { status: 413 });
    return new NextResponse(bytes, { headers: { "Content-Type": DOCX, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không kết nối được Google Docs, vui lòng thử lại." }, { status: 502 });
  }
}
