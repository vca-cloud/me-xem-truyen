# Mê Xem Truyện

Nền tảng đọc truyện chữ online: Next.js 16 (App Router) + Supabase (database, đăng nhập) + Cloudflare R2 (file chương, ảnh bìa), triển khai trên Vercel. Kiếm tiền bằng Google AdSense, Shopee Affiliate và Xu (mở khóa chương).

Tài liệu kỹ thuật đầy đủ cho người phát triển: [CLAUDE.md](CLAUDE.md).

## Chạy trên máy

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị thật
npm run dev                  # http://localhost:3000
```

Biến bắt buộc: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Xem chú thích trong `.env.example` cho các biến còn lại.

## Thiết lập database (Supabase)

Chạy lần lượt trong **Supabase → SQL Editor**, mỗi file một lần:

1. `supabase/migrations/0001_initial.sql` — quản trị viên
2. `supabase/migrations/0002_stories_chapters.sql` — truyện, chương, thể loại
3. `supabase/migrations/0003_analytics.sql` — lượt xem, affiliate, AdSense
4. `supabase/migrations/0004_coins.sql` — Xu, khóa chương
5. `supabase/migrations/0005_admin_tools.sql` — quản lý chương/quản trị viên, chống spam, xác thực 2 lớp

Sau đó chạy `notify pgrst, 'reload schema';` và tạo tài khoản admin (xem CLAUDE.md mục 9).

## Các trang chính

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ |
| `/truyen/<slug>` | Giới thiệu truyện, danh sách chương |
| `/truyen/<slug>/chuong/<số>` | Đọc chương (chương khóa cần Xu) |
| `/tai-khoan` | Ví Xu, lịch sử, chương đã mở |
| `/admin` | Quản trị: doanh thu, truyện, affiliate, thành viên, quản trị viên, thể loại, cài đặt |

## Kiểm tra trước khi bàn giao

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Tự động hóa (GitHub Actions)

- `supabase-keepalive.yml` — giữ project Supabase gói Free không bị tạm dừng. Cần secret `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- `supabase-backup.yml` — sao lưu database mỗi đêm (giữ 30 ngày). Cần secret `SUPABASE_DB_URL` (chuỗi "Session pooler").
