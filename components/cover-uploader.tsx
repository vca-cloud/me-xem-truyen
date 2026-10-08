"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Crop, ImageUp, Maximize, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Mode = "full" | "crop";

// Paints the cover onto a canvas of the given size.
// "full": the whole image, scaled to fit inside 4:5; any empty band is filled with a soft, darkened, enlarged copy
//         of the same image (blurred by drawing it tiny and scaling up, which works in every browser).
// "crop": only the chosen 4:5 area.
function paint(image: HTMLImageElement, mode: Mode, area: Area | null, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#102D54";
  context.fillRect(0, 0, width, height);
  if (mode === "crop" && area) {
    context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
    return canvas;
  }
  const iw = image.naturalWidth, ih = image.naturalHeight;
  const cover = Math.max(width / iw, height / ih);
  const tiny = document.createElement("canvas");
  tiny.width = 24;
  tiny.height = 30;
  const tinyContext = tiny.getContext("2d")!;
  tinyContext.drawImage(image, (24 - iw * cover * 24 / width) / 2, (30 - ih * cover * 30 / height) / 2, iw * cover * 24 / width, ih * cover * 30 / height);
  context.drawImage(tiny, 0, 0, width, height);
  context.fillStyle = "rgba(0, 0, 0, 0.25)";
  context.fillRect(0, 0, width, height);
  const fit = Math.min(width / iw, height / ih);
  context.drawImage(image, (width - iw * fit) / 2, (height - ih * fit) / 2, iw * fit, ih * fit);
  return canvas;
}

// Encodes as WebP (JPEG on browsers that cannot encode WebP), lowering quality until it fits the server's byte limit.
async function encode(canvas: HTMLCanvasElement, maxBytes: number, type?: string) {
  for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5]) {
    let blob = await toBlob(canvas, type ?? "image/webp", quality);
    if (blob && !type && blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("Ảnh quá phức tạp, không nén được đủ nhẹ.");
}

// Cover field: upload a photo, keep it whole (default) or crop it to 4:5 in the browser, store 600×750 + 300×375 copies on R2.
// A link pasted by hand still works for covers hosted elsewhere.
export function CoverUploader({ id, value, onChange, uploadUrl }: { id?: string; value: string; onChange: (url: string) => void; uploadUrl: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  // Covers uploaded while this form is open: if one is replaced or removed before saving, it is discarded on R2
  // right away (the server only deletes it when no story uses it).
  const uploadedHere = useRef(new Set<string>());

  function discard(url: string) {
    if (!uploadedHere.current.has(url)) return;
    uploadedHere.current.delete(url);
    fetch(`${uploadUrl}?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
  }
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);

  // The crop window always equals the whole 4:5 frame (the cropper's default leaves a 5% margin that trims the edges).
  // Measured with a ref callback because the frame only mounts once the dialog has opened.
  const frame = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function choose(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
    if (file.size > MAX_SOURCE_BYTES) return toast.error("Ảnh gốc tối đa 15 MB.");
    const url = URL.createObjectURL(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setMode("full");
    setSource(url);
    loadImage(url).then((loaded) => {
      setImage(loaded);
      setPreview(paint(loaded, "full", null, 480, 600).toDataURL("image/jpeg", 0.85));
    }).catch(() => { toast.error("Không đọc được ảnh."); close(); });
  }

  function close() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setImage(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function upload() {
    if (!image || (mode === "crop" && !area)) return;
    setPending(true);
    try {
      const { large: L, small: Sm } = COVER_SIZES;
      const large = await encode(paint(image, mode, area, L.width, L.height), L.maxBytes);
      const small = await encode(paint(image, mode, area, Sm.width, Sm.height), Sm.maxBytes, large.type);
      const form = new FormData();
      form.append("large", large, `cover.${large.type === "image/webp" ? "webp" : "jpg"}`);
      form.append("small", small, `cover-sm.${large.type === "image/webp" ? "webp" : "jpg"}`);
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Không tải được ảnh lên.");
      if (value) discard(value);
      uploadedHere.current.add(body.url);
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
      {value && brokenUrl !== value ? <img src={value} alt="Ảnh bìa hiện tại" className="size-full object-cover" onError={() => setBrokenUrl(value)} /> : <div className={`flex size-full items-center justify-center p-1 text-center text-[10px] ${value ? "text-destructive" : "text-muted-foreground"}`}>{value ? "Không tải được ảnh, hãy tải lại" : "Chưa có ảnh"}</div>}
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><ImageUp />Tải ảnh lên</Button>
        {value && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { discard(value); onChange(""); }}><Trash2 />Bỏ ảnh</Button>}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />
      </div>
      <Input id={id} type="url" value={value} onChange={(event) => onChange(event.target.value)} placeholder="hoặc dán link ảnh https://..." aria-label="Link ảnh bìa" />
    </div>

    <Dialog open={!!source} onOpenChange={(open) => { if (!open && !pending) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ảnh bìa 4:5</DialogTitle><DialogDescription>Ảnh được lưu cỡ 600 × 750 và 300 × 375 (WebP), dùng chung cho điện thoại và máy tính.</DialogDescription></DialogHeader>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="full"><Maximize />Giữ nguyên toàn bộ ảnh</TabsTrigger>
            <TabsTrigger value="crop"><Crop />Cắt ảnh</TabsTrigger>
          </TabsList>
        </Tabs>
        <div ref={frame} className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-md bg-black">
          {mode === "full"
            // eslint-disable-next-line @next/next/no-img-element -- local preview (data URL)
            ? preview && <img src={preview} alt="Xem trước ảnh bìa" className="size-full object-cover" />
            : source && frameSize && <Cropper image={source} crop={crop} zoom={zoom} aspect={4 / 5} maxZoom={4} cropSize={frameSize} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} objectFit="cover" />}
        </div>
        {mode === "full"
          ? <p className="text-sm text-muted-foreground">Không cắt mất phần nào. Ảnh không đúng tỷ lệ 4:5 sẽ có nền mờ lấp phần trống.</p>
          : <label className="flex items-center gap-3 text-sm"><ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Phóng to</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-[var(--highlight)]" />
          </label>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={close}>Hủy</Button>
          <Button type="button" disabled={pending || !image || (mode === "crop" && !area)} onClick={upload} className="bg-highlight text-highlight-foreground hover:bg-highlight/90"><ImageUp />{pending ? "Đang xử lý..." : "Tải lên"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
