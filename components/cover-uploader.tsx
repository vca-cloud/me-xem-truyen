"use client";

import { useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { ImageUp, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { COVER_SIZES } from "@/lib/cover";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được ảnh."));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// Draws the chosen 4:5 area at one output size and encodes it as WebP (JPEG on browsers that cannot
// encode WebP), lowering quality until it fits the server's byte limit.
async function render(image: HTMLImageElement, area: Area, size: (typeof COVER_SIZES)["large" | "small"], type?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height);
  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
    let blob = await toBlob(canvas, type ?? "image/webp", quality);
    if (blob && !type && blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= size.maxBytes) return blob;
  }
  throw new Error("Ảnh quá phức tạp, không nén được đủ nhẹ.");
}

// Cover field: upload a photo, crop it to 4:5 in the browser, store 600×750 + 300×375 copies on R2.
// A link pasted by hand still works for covers hosted elsewhere.
export function CoverUploader({ id, value, onChange, uploadUrl }: { id?: string; value: string; onChange: (url: string) => void; uploadUrl: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);

  function choose(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
    if (file.size > MAX_SOURCE_BYTES) return toast.error("Ảnh gốc tối đa 15 MB.");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setSource(URL.createObjectURL(file));
  }

  function close() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function upload() {
    if (!source || !area) return;
    setPending(true);
    try {
      const image = await loadImage(source);
      const large = await render(image, area, COVER_SIZES.large);
      const small = await render(image, area, COVER_SIZES.small, large.type);
      const form = new FormData();
      form.append("large", large, `cover.${large.type === "image/webp" ? "webp" : "jpg"}`);
      form.append("small", small, `cover-sm.${large.type === "image/webp" ? "webp" : "jpg"}`);
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Không tải được ảnh lên.");
      onChange(body.url);
      toast.success(`Đã tải ảnh bìa (${Math.round(large.size / 1000)} KB). Nhớ bấm Lưu để cập nhật truyện.`);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được ảnh lên.");
    } finally {
      setPending(false);
    }
  }

  return <div className="flex gap-3">
    <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- preview of an admin-provided URL */}
      {value ? <img src={value} alt="Ảnh bìa hiện tại" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">Chưa có ảnh</div>}
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><ImageUp />Tải ảnh lên</Button>
        {value && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange("")}><Trash2 />Bỏ ảnh</Button>}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />
      </div>
      <Input id={id} type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="hoặc dán link ảnh https://..." aria-label="Link ảnh bìa" />
    </div>

    <Dialog open={!!source} onOpenChange={(open) => { if (!open && !pending) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Cắt ảnh bìa 4:5</DialogTitle><DialogDescription>Kéo ảnh để chọn phần muốn giữ, kéo thanh trượt để phóng to. Ảnh sẽ được lưu cỡ 600 × 750 và 300 × 375 (WebP).</DialogDescription></DialogHeader>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-md bg-black">
          {source && <Cropper image={source} crop={crop} zoom={zoom} aspect={4 / 5} maxZoom={4} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} objectFit="cover" />}
        </div>
        <label className="flex items-center gap-3 text-sm"><ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Phóng to</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-[var(--highlight)]" />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={close}>Hủy</Button>
          <Button type="button" disabled={pending || !area} onClick={upload} className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><ImageUp />{pending ? "Đang xử lý..." : "Cắt & tải lên"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
