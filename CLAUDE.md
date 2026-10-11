# Mê Xem Truyện — Project Guide

## 1. Mục đích dự án

“Mê Xem Truyện” là nền tảng đọc truyện chữ trực tuyến xây dựng bằng Next.js App Router, kiếm tiền bằng **Google AdSense** và **Shopee Affiliate**. Ứng dụng phục vụ hai nhóm người dùng:

- Người đọc: tìm kiếm truyện, lọc thể loại, xem thông tin truyện, đọc chương, đăng nhập/đăng ký.
- Tác giả (thành viên được admin duyệt): đăng truyện, viết chương, khóa chương bằng Xu, nhận phần trăm doanh thu.
- Quản trị viên: theo dõi doanh thu và lưu lượng, quản lý truyện, kiểm duyệt nội dung, tác giả, link affiliate, thành viên, quản trị viên, thể loại và cài đặt.

Supabase là Auth/database; Cloudflare R2 lưu ảnh bìa và file nội dung chương `.txt`; ứng dụng deploy trên Vercel. Toàn bộ màn hình dùng dữ liệu thật (không còn mock).

## 2. Công nghệ và cấu trúc

- Next.js 16 App Router, TypeScript strict, React 19, Tailwind CSS 4.
- shadcn/ui style base-nova (Base UI). Component trong `components/ui/`: alert, alert-dialog, badge, button, card, checkbox, combobox, dialog, dropdown-menu, field, input, input-group, label, select, separator, skeleton, sonner, table, tabs, textarea, tooltip. Thêm mới bằng `npx shadcn@latest add <tên>`.
- Quy ước UI: form dùng `Field`/`FieldLabel`/`FieldDescription`/`FieldError`; hộp nhập dùng `Dialog`; xác nhận xóa dùng `useConfirm()` (`components/confirm-dialog.tsx`, AlertDialog) — không dùng `window.confirm`; thông báo dùng `toast` từ `sonner` (`<Toaster>` trong layout); chọn một giá trị dùng `Select` (truyền `items` để `SelectValue` hiện nhãn); tìm-và-chọn dùng `Combobox` (thể loại: `components/genre-combobox.tsx` nhiều lựa chọn + tạo mới; chọn chương: `components/chapter-nav.tsx`); bảng dùng `Table`; trạng thái dùng `Badge`/`StatusBadge`.
- `Button` hiển thị thành link phải dùng `nativeButton={false} render={<Link href=… />}` — không lồng `<Button>` trong `<Link>`.
- Font: Raleway (`next/font/google`, subset vietnamese) qua biến `--font-raleway`; bật `lnum` để số không bị kiểu old-style.
- Tên thương hiệu: mọi chỗ hiện “mê xem truyện” trong giao diện dùng `<BrandName />` (`components/logo.tsx`): chữ thường, đậm, “mê” màu cam `highlight`, cỡ chữ và màu phần còn lại theo đoạn văn xung quanh. `siteInfo.name` (lib/site.ts) là “mê xem truyện” chỉ dùng cho text thuần (metadata, tiêu đề tab). Logo header `<Logo />` = BrandName 54px (36px trên điện thoại, 24px ở thanh bên admin).
- Chữ hiển thị chỉ viết hoa chữ cái đầu (không ALL CAPS, không class `uppercase`); tiêu đề mục là `h2` cỡ 30px/36px (`text-3xl sm:text-4xl`); ô truyện có ảnh bìa (`StoryTile`) chữ 1.5× (tên 24px, dòng phụ 21px); danh sách truyện có cột Tình trạng (`StatusBadge`), trên điện thoại ẩn cột Thể loại; header bảng in đậm (`TableHead` đã `font-bold`).
- Màu: chỉ dùng token trong `app/globals.css` (bảng màu navy `#102D54`, blue `#2D74A8`, royal `#154B95`, mint `#D4EEE4`, ice `#D4EEED`, cam Shopee `#EE4D2D`), không viết mã màu cứng. Token riêng: `header`/`header-foreground` (header, footer), `highlight` (cam — nút chính, NEW, mục đang chọn, hover link), `brand`. Sáng/tối: class `dark` trên `<html>`, nút `ThemeToggle` (`components/theme-toggle.tsx`) lưu `localStorage.theme`, script trong `app/layout.tsx` áp trước khi vẽ (**mặc định tối**; chỉ sáng khi người đọc chọn `light`; không áp cho `/admin`).
- Lucide React cho icon. Biểu đồ dựng bằng CSS/Tailwind, không dùng thư viện chart.
- `@supabase/supabase-js`, `@supabase/ssr`.
- Path alias `@/*` trỏ tới thư mục gốc. Mã nguồn đặt trực tiếp tại root; không tạo thư mục dự án lồng nhau.

```text
app/                  # Routes, layouts, route handlers
components/           # UI dùng chung, admin shell, ads, tracking
components/ui/        # Primitive shadcn/ui
lib/                  # Supabase clients, auth, analytics, ads, import, moderation, authors, R2, covers
supabase/migrations/  # SQL schema/RLS migrations (chạy theo thứ tự số)
public/               # Static assets
```

## 3. Các route hiện có

### Public

- `/` — trang chủ: truyện mới đăng, mới cập nhật, hoàn thành, danh sách có lọc thể loại/tìm kiếm/phân trang (dữ liệu thật từ `stories`).
- `/truyen/[slug]` — giới thiệu truyện và danh sách chương (`?thu_tu=moi` để xếp mới → cũ); slug không tồn tại trả 404.
- `/truyen/[slug]/chuong/[chapterNumber]` — đọc chương; nội dung lấy từ `text_url` (file `.txt` public trên R2).
- `/dang-nhap`, `/dang-ky` — email/password hoặc Google (Turnstile nếu có `NEXT_PUBLIC_TURNSTILE_SITE_KEY`); `?next=` qua `safeInternalPath`.
- `/tim-kiem` — tìm nâng cao: `q` (tên/tác giả/thể loại, không phân biệt dấu), `the_loai` (slug, phân tách dấu phẩy), `che_do=mot-trong` (mặc định có tất cả), `trang_thai`, `sap_xep` (`cap-nhat`/`moi-dang`/`nhieu-chuong`/`ten`), `trang`; noindex. Logic ở `lib/search.ts`. Header dùng chung `components/site-header.tsx` (menu thể loại lấy từ bảng `genres` qua `getGenreCatalog()`, ô tìm kiếm → `/tim-kiem`) cho trang chủ, trang truyện, trang tìm kiếm.
- `/tac-gia` — khu vực tác giả (đăng ký làm tác giả, truyện của tôi, rút Xu), `/tac-gia/truyen/[id]` — viết/sửa chương; `/dieu-khoan-tac-gia` — điều khoản tác giả.
- `/tai-khoan` — ví Xu thành viên. `/gioi-thieu`, `/dieu-khoan`, `/chinh-sach-bao-mat`, `/lien-he` — trang thông tin (thông tin công ty lấy từ `lib/site.ts` / `NEXT_PUBLIC_COMPANY_*`).
- `/sitemap.xml` (truyện + chương miễn phí), `/robots.txt` (chặn admin/api/go/tai-khoan/tac-gia).
- `/auth/callback` — OAuth callback, đổi code thành session.
- `/go/[id]` — redirect affiliate: ghi click rồi chuyển 302 tới link Shopee (`?s=<slug>&c=<chương>`).
- `/ads.txt` — sinh từ `NEXT_PUBLIC_ADSENSE_CLIENT`; trả 404 khi AdSense chưa bật.
- `POST /api/track/view` — ghi lượt xem (gọi từ `components/view-tracker.tsx`).

### Admin

- `/admin/dang-nhap` — đăng nhập quản trị; `/admin/xac-thuc` — nhập mã 2 lớp (cả hai ngoài protected route group).
- `/admin` — dashboard doanh thu & theo dõi.
- `/admin/luot-xem` — lượt xem thật: tổng từ trước tới nay, người đọc, hôm nay/7/30 ngày, biểu đồ theo ngày (`?ngay=7|30|90`), bảng theo truyện (tổng, 30/7 ngày, người đọc, sparkline 14 ngày), công tắc Ghim HOT (RPC `admin_view_stats`).
- `/admin/truyen` — đăng truyện, thêm chương, sửa thông tin (tên truyện cố định để giữ link), xóa, import CSV; dữ liệu thật.
- `/admin/kiem-duyet` — hàng chờ duyệt chương (bị gắn cờ hoặc tác giả gửi), duyệt/đăng/từ chối, bật/tắt quảng cáo từng chương, sửa từ điển che từ (mục 8d).
- `/admin/tac-gia` — duyệt hồ sơ tác giả, đặt % doanh thu, xử lý yêu cầu rút Xu (mục 8e).
- `/admin/affiliate` — quản lý link Shopee, nhập báo cáo đơn hàng Shopee và AdSense.
- `/admin/thanh-vien` (thành viên, cộng/trừ Xu), `/admin/quan-tri-vien` (cấp/sửa/gỡ quyền, đổi mật khẩu), `/admin/the-loai` (thêm/đổi tên/xóa), `/admin/cai-dat` (bật/tắt xác thực 2 lớp, xem thông tin website). Tất cả dùng dữ liệu thật.

API admin: `/api/admin/stories` (POST đăng truyện), `/api/admin/stories/[id]` (PATCH sửa, DELETE xóa), `/api/admin/stories/[id]/chapters` (POST thêm chương), `/api/admin/stories/import`, `/api/admin/affiliate-links[/id]`, `/api/admin/revenue/import`, `/api/admin/analytics/export`, `/api/admin/administrators/[id]/password`. Trang admin gọi `requireAdmin()` (redirect); API admin gọi `guardAdminApi(roleAccess.X)` trả 401/403. Quyền theo vai trò (`lib/auth.ts` → `roleAccess`): `view`/`content` cho admin, editor, moderator; `destructive` (xóa truyện/chương/thể loại), `money` (affiliate, doanh thu, Xu), `admins` chỉ cho `admin`. Thêm API mới: `/api/admin/stories/[id]/chapters` (GET), `/api/admin/chapters/[id]` (PATCH/DELETE — chương đã có người mua không xóa được), `/api/admin/administrators` (POST) + `[id]` (DELETE), `/api/admin/genres` (POST) + `[id]` (PATCH/DELETE), `/api/admin/covers` (POST ảnh bìa), `/api/admin/r2/folders|preview`, `/api/admin/stories/[id]/moderation` (quét lại), `/api/admin/moderation-terms[/id]`, `/api/admin/authors/[id]`, `/api/admin/payouts/[id]`.

API tác giả (`guardAuthorApi()`, ghi bằng service role sau khi kiểm session + quyền sở hữu): `/api/author/apply`, `profile`, `stories[/id]`, `stories/[id]/chapters`, `chapters/[id]` (GET/PATCH/DELETE), `covers`, `payouts`.

## 4. Giao diện đã triển khai

### Trang chủ

- Server component `app/page.tsx` tải truyện, client component `components/home-page.tsx` hiển thị.
- Header dùng chung (`components/site-header.tsx`): logo, menu Thể loại (từ admin), ô tìm kiếm → `/tim-kiem`, đăng nhập/đăng ký hoặc số Xu, nút sáng/tối. Điện thoại: dòng 1 logo + sáng/tối, dòng 2 menu + tìm kiếm + tài khoản.
- Section **Gợi ý truyện** ở đầu (4 ô ảnh bìa): truyện admin chọn (`stories.featured`, mới chọn nhất trước — công tắc “Gợi ý” ở cột Tag `/admin/truyen` hoặc ô trong form), thiếu thì lấp bằng truyện nhiều lượt xem thật 7 ngày, rồi truyện mới cập nhật; 4 truyện được chọn hiển thị theo ngày cập nhật, mới nhất trước (`app/page.tsx`).
- Section truyện mới đăng (ô ảnh bìa 4:5, nhãn NEW trong 7 ngày, FULL khi hoàn thành), mới cập nhật (bảng), truyện hoàn thành; ẩn section trống.
- Tag trên ảnh bìa: HOT (cam `highlight`, icon lửa), NEW (#2D74A8, 7 ngày), FULL (#154B95, hoàn thành) — `StoryTag`; số lượt xem thật góc phải ảnh bìa; bảng có cột Lượt xem (từ `sm`) và đủ tag HOT/NEW/FULL nhỏ cạnh tên (trang chủ, tìm kiếm). Quy tắc tag dùng chung `storyTags()` trong `lib/views.ts`.
- Danh sách truyện lọc theo thể loại trong admin, phân trang 10 truyện/trang; cột Tình trạng; badge thể loại một dòng, truncate text.
- Cover/tên truyện liên kết tới `/truyen/[slug]`.

### Trang chi tiết truyện

- Breadcrumb dạng `Trang chủ › Tên truyện`.
- Ảnh bìa (`cover_url`), tác giả, thể loại, trạng thái, lượt xem (thật), tổng chương, ngày cập nhật; tag HOT nếu có. Không hiển thị rating khi chưa có dữ liệu thật.
- Nút đọc từ đầu, đọc mới nhất, Mê Nghe Truyện, tủ sách (đang tắt — chưa làm); mô tả và danh sách chương (2 cột, mỗi cột tối đa 10 chương, 20 chương/trang, `?trang=`).

### Trang đọc chương

- Header gọn (logo 30px trên điện thoại, tài khoản, nút sáng/tối), điều hướng chương trước / chọn chương (Combobox) / chương sau ở trên và dưới.
- Nội dung 24px (1.5× cỡ thường), dòng cách 1.8; tên chương 28px/36px. Từ nhạy cảm được che (`maskForReaders`). Dòng “Chương N: …” lặp ở đầu file bị bỏ (`stripChapterHeading`).

### Ảnh bìa

- Khung 4:5 ở mọi nơi (`COVER_ASPECT_CLASS`, `lib/cover.ts`), `object-cover` (không méo; sai tỷ lệ thì cắt). Một ảnh dùng chung điện thoại và máy tính.
- Tải ảnh trong form truyện (admin + tác giả) bằng `components/cover-uploader.tsx`, 2 chế độ: **Giữ nguyên toàn bộ ảnh** (mặc định — cả ảnh thu vào khung 4:5, phần trống lấp bằng bản phóng to mờ của chính ảnh, không cắt mất gì) và **Cắt ảnh** (`react-easy-crop`, `cropSize` = đúng cả khung vì mặc định thư viện chừa lề 5% làm mất viền); trình duyệt xuất 600×750 + 300×375 WebP (JPEG nếu trình duyệt không mã hóa được WebP), gửi `POST /api/admin/covers` (vai trò `content`) hoặc `/api/author/covers`. Vẫn nhận link dán tay (host khác thì không có srcset).
- Server (`lib/cover-storage.ts`) đọc header file kiểm định dạng (chỉ JPEG/WebP), kích thước đúng, dung lượng (≤ 400 KB / 200 KB); lưu R2 public `covers/<uuid>.webp` + `covers/<uuid>-sm.webp`, `Cache-Control: public, max-age=31536000, immutable`.
- Hiển thị qua `coverImageProps()` (srcset 300w/600w, width/height chống giật trang; trang chủ `loading=lazy`, trang truyện `fetchPriority=high`).
- Mỗi ảnh = 2 file trên R2 (`<id>.webp` + `<id>-sm.webp`). Thay/bỏ ảnh hoặc xóa truyện → `deleteCoverIfUnused()` xóa cả 2 file nếu không truyện nào dùng. Trong form, ảnh vừa tải nhưng bị thay/bỏ trước khi lưu được xóa ngay (`DELETE /api/admin/covers?url=` / `/api/author/covers?url=`). Ảnh tải lên rồi đóng form không lưu: `cleanupOrphanCovers()` chạy sau mỗi lần tải ảnh (`after()`, tối đa 1 lần/giờ/instance) xóa ảnh không truyện nào dùng và cũ hơn 24 giờ.
- R2 PUT/DELETE có timeout (20s/15s) và thử lại 3 lần khi lỗi mạng/5xx; lỗi xóa được ghi log `[covers]`, không chặn việc lưu truyện.

### Admin dashboard (`/admin`)

Tập trung vào doanh thu AdSense + Shopee, dữ liệu lấy từ RPC `admin_revenue_dashboard`. Không có chỉ số “lượt xem ảo”, không ghi “realtime”.

- Bộ lọc 7 ngày / 30 ngày / 90 ngày / 12 tháng (ngày theo giờ Việt Nam), nút xuất CSV thật.
- Doanh thu: tổng, AdSense, hoa hồng Shopee (đã duyệt / chờ duyệt / hủy), RPM tổng.
- Lưu lượng & chuyển đổi: lượt xem thực, người đọc, CTR AdSense, click affiliate, CTR affiliate, đơn hàng, tỷ lệ chuyển đổi, EPC.
- Biểu đồ theo ngày; bảng theo vị trí đặt link, top link, ad unit, thiết bị, top truyện (AdSense ước tính = lượt xem × RPM toàn site).
- Cảnh báo: CTR AdSense > 5%, lượt xem hệ thống lệch AdSense > 30%, nhiều click không có đơn, chưa import báo cáo.
- Khi không tải được dữ liệu, hiển thị số 0 kèm thông báo lỗi rõ ràng.

## 5. Supabase Auth và session

- Email/password, Google OAuth, cookie-based session, refresh qua `proxy.ts`.
- `lib/supabase/client.ts` (browser, public key), `lib/supabase/server.ts` (server, cookie), `lib/supabase/proxy.ts`, `proxy.ts`.
- `lib/auth.ts` — `requireAdmin()` kiểm tra user và profile trong `admin_profiles`.
- `components/auth-forms.tsx`, `app/auth/callback/route.ts`.
- Role admin hợp lệ: `admin`, `editor`, `moderator`; status phải là `active`.

Tài khoản admin **không tạo qua trang đăng ký**; admin được tạo trực tiếp trong Supabase (mục 9). Không tin role do client gửi lên; mọi mutation phải kiểm tra session/role ở server và tuân theo RLS.

### Bỏ qua đăng nhập khi phát triển

`ADMIN_AUTH_BYPASS=true` trong `.env.local` cho phép vào thẳng `/admin` (và `/admin/dang-nhap` tự chuyển về `/admin`), **chỉ khi chạy `next dev`** (`lib/admin-bypass.ts`; không có tác dụng ở production build). Chế độ này chỉ mở giao diện: RPC và API admin vẫn từ chối vì không có session, nên dashboard hiển thị 0 kèm cảnh báo. Muốn xem số liệu thật phải tắt cờ và đăng nhập bằng admin thật.

## 6. Database và migration

Chạy theo thứ tự trong Supabase SQL Editor:

1. `0001_initial.sql` — `admin_profiles` (một-một với `auth.users`), enum role/status, trigger đồng bộ email, helper `is_admin()`, RLS. Password do Supabase Auth quản lý, không lưu trong bảng.
2. `0002_stories_chapters.sql` — `stories`, `genres`, `story_genres`, `chapters`; đọc public, admin ghi.
3. `0003_analytics.sql` — tracking và doanh thu (tiền tính bằng VND):
   - `view_events`, `affiliate_links`, `affiliate_clicks`, `affiliate_conversions`, `adsense_daily` — chỉ admin đọc/ghi qua RLS.
   - `track_view(...)` — public, security definer; khử trùng cùng visitor/truyện/chương trong 15 phút (0010; ban đầu 30).
   - `track_affiliate_click(...)` — public; trả link đích nếu link đang bật; khử trùng 1 phút.
   - `admin_revenue_dashboard(p_from date, p_to date)` — chỉ admin; trả JSON tổng hợp cho dashboard.

4. `0004_coins.sql` — Xu, khóa chương, ẩn `chapters.text_url` (xem mục 8b).
5. `0005_admin_tools.sql` — `stories.ads_disabled`, `admin_list_chapters()`, `admin_set_admin()`/`admin_remove_admin()` (luôn giữ ≥ 1 admin), giới hạn 300 lượt xem/giờ/IP (`view_events.ip_hash`, `track_view` 6 tham số), xác thực 2 lớp trong DB (`admin_mfa_ok()`, `is_admin()` và `is_full_admin()` yêu cầu `aal2` nếu admin đã đăng ký TOTP), gỡ policy cho admin tự sửa `admin_profiles`.

6. `0006_chapter_counts.sql` — `story_chapter_counts()` (đếm chương công khai, vì `text_url` đã bị ẩn).
7. `0007_moderation.sql` — `moderation_terms` (309 từ khởi đầu; mức 1 = chỉ che, 2 = tắt QC + duyệt tay, 3 = tắt QC + duyệt, có thể 18+), cột chương `ads_enabled`, `moderation_status` (unscanned/clean/pending/approved), `moderation_score`, `moderation_hits`, `is_mature`; `admin_moderation_summary()`, `admin_moderation_queue()`.
8. `0008_authors.sql` — `author_profiles`, `stories.owner_id`, `chapters.publish_status` (draft/submitted/published/rejected) + `review_note`/`submitted_at`; RLS chỉ hiện chương đã đăng (truyện của tác giả chỉ hiện khi có chương đã đăng); `author_earnings`, `author_payouts` (một yêu cầu/kỳ), `unlock_chapter()` ghi phần tác giả, `author_balance()`, `admin_list_authors()`.

9. `0009_views.sql` — `stories.hot_pinned`; `story_view_stats()` (public: tổng + 7 ngày + hot_pinned theo truyện, chỉ truyện đang công khai); `admin_view_stats(p_days)` (admin: tổng, người đọc, hôm nay/7/30 ngày, chuỗi theo ngày, theo truyện + sparkline 14 ngày).

10. `0010_view_window.sql` — `track_view` tính lại lượt xem cùng người/cùng trang sau 15 phút (trước 30); giữ giới hạn 300 lượt/giờ/IP.

11. `0011_moderation_rescan.sql` — `moderation_state` (chỉ server đọc), trigger cập nhật thời điểm đổi từ điển, index `chapters.moderated_at`.
12. `0012_affiliate_popup.sql` — `stories.affiliate_enabled/affiliate_gate_minutes/affiliate_link_id`, `affiliate_links.image_url/headline`, RPC `story_affiliate_popup`.
13. `0013_featured.sql` — `stories.featured` + `featured_at` (trigger đóng dấu thời điểm chọn) cho “Gợi ý truyện”.

Đã chạy `0001`–`0010` trên project hiện tại (`0011`–`0013` chờ chạy nếu chưa). Bảng còn có thể bổ sung sau: tủ sách, đơn nạp Xu (`topup_orders`), gom lượt xem theo ngày.

## 7. Import truyện hàng loạt

Tại `/admin/truyen`: **Tải file mẫu** (`mau-import-truyen-nhieu-chuong.csv`, 3 truyện / 10 chương) và **Import hàng loạt**. Logic ở `lib/story-import.ts`, API `POST /api/admin/stories/import`.

- Mỗi dòng là một chương; các dòng cùng `title` gộp thành một truyện.
- Bắt buộc: `title`, `author`, `chapter_number`, `chapter_title`, `text_url`. Tùy chọn: `description`, `cover_url`, `audio_url`, `status`, `genres`.
- Thông tin truyện (mô tả, ảnh, audio, trạng thái, thể loại) lấy từ dòng đầu tiên của truyện; các dòng sau có thể để trống. Thể loại được tạo tự động trong `genres` và liên kết qua `story_genres` (`lib/stories.ts` → `setStoryGenres`).
- Nhiều thể loại phân tách bằng `|`. `status`: `Đang ra`, `Hoàn thành`, `Tạm dừng`. URL phải `http(s)://`.
- File UTF-8 (có BOM được), tối đa 5 MB. Truyện đã tồn tại (trùng slug) bị từ chối — bổ sung chương bằng nút “Thêm chương”. File `.txt` trên R2 phải public.
- Đọc dữ liệu truyện ở server qua `lib/stories.ts` (`listStories`, `getStory`); nội dung chương fetch từ `text_url`, cache 1 giờ.

## 8. Theo dõi doanh thu và kiếm tiền

### Tracking

- Lượt xem: `components/view-tracker.tsx` trên trang truyện/chương gọi `POST /api/track/view`; lọc bot theo user-agent; visitor id ẩn danh trong cookie `mxt_vid`; không lưu IP.
- Click affiliate: link trên trang đọc phải trỏ tới `/go/<link-id>?s=<slug>&c=<chương>`, không trỏ thẳng Shopee.
- Helpers: `lib/tracking.ts`, `lib/analytics.ts` (server), `lib/analytics-shared.ts` (types, nhãn vị trí, công thức RPM/CTR/EPC, định dạng VND).

### Shopee Affiliate

- `/admin/affiliate`: thêm/sửa/bật-tắt/xóa link, sao chép link theo dõi `/go/…`. Vị trí: đầu/giữa/cuối chương, trang truyện, trang chủ, thanh bên, khác.
- Đơn hàng nhập bằng CSV `order_id,sub_id,order_amount,commission,status,ordered_at` (upsert theo `order_id`). Đơn gán vào link qua `sub_id`, nên Sub ID khi tạo link trên Shopee phải trùng Sub ID trong admin.
- **Pop-up Shopee theo truyện** (migration `0012`, chủ dự án yêu cầu 11/10/2026 sau khi được báo rủi ro): `/admin/truyen` có cột **Kiếm tiền** (công tắc AdSense = `!ads_disabled`, Shopee = `affiliate_enabled`, `components/story-flag-switch.tsx`) và phần “Kiếm tiền” trong form (link riêng `affiliate_link_id` hoặc tự động theo link vị trí `popup`; tần suất `affiliate_gate_minutes` 0/30/120/1440 — `lib/affiliate-settings.ts`). Chương **miễn phí** đọc được của truyện bật Shopee hiện `components/shopee-gate.tsx`: nội dung vẫn render phía sau (làm mờ, không cloaking — Google thấy cùng pop-up), nút “Mở Shopee & đọc tiếp” (đặt ngay dưới thẻ sản phẩm để luôn thấy trên màn hình) mở `/go/<id>?s=&c=` ở tab mới rồi mở khóa. Tần suất 0 = “Mỗi lần mở chương”: không lưu gì, vào lại / tải lại / nút Back (bfcache, `pageshow`) đều phải bấm lại; 30/120/1440 phút: nhớ lượt bấm cho cả truyện trong `localStorage` (`mxt_shopee:<storyId>`). Cỡ chữ lớn (tiêu đề 36/45px, nút cao 80/96px). Dòng cuối (công khai affiliate): “mê xem truyện cần kinh phí để duy trì kênh miễn phí và có thể nhận hoa hồng từ liên kết này. Mong bạn thông cảm.” RPC công khai `story_affiliate_popup(story_id)` chỉ trả id/tên/ảnh/câu giới thiệu, không lộ link Shopee. Link affiliate có thêm `image_url`, `headline` (form ở `/admin/affiliate`, hiện khi vị trí “Pop-up mở chương”).
- Rủi ro đã báo chủ dự án: điều khoản Shopee Affiliate (click bắt buộc), Better Ads/AdSense (pop-up che nội dung — form cảnh báo khi bật cả AdSense và Shopee), xếp hạng Google trên mobile, tỷ lệ thoát.

### AdSense

- Báo cáo nhập bằng CSV `date,ad_unit,page_views,impressions,clicks,earnings` (upsert theo ngày + ad unit). Tên ad unit trên AdSense nên trùng cột `ad_unit`.
- Component dựng sẵn nhưng **tắt**: `lib/ads.ts` (cấu hình vị trí, chia quảng cáo giữa chương ~900 chữ, tối đa 3, không đặt trong 300 chữ cuối), `components/ads.tsx` (`AdSenseScript`, `AdSlot`), `app/ads.txt/route.ts`.
- Vị trí: `home-top`, `home-feed`, `story-detail`, `chapter-top`, `chapter-mid` (in-article), `chapter-end` (multiplex, cách nút chuyển chương). Mỗi vị trí chỉ hiện khi có slot id riêng.
- `AdSlot` chừa sẵn chiều cao, có nhãn “Quảng cáo”, lazy load bằng IntersectionObserver, `data-adtest` ngoài production, hỗ trợ `disabled` cho truyện nhạy cảm.
- Chỉ đặt `AdSenseScript`/`AdSlot` trên trang chủ, trang truyện, trang chương có nội dung — không đặt ở trang đăng nhập, admin, lỗi hoặc chương trống.
- Khởi đầu đề xuất: giữa chương + cuối chương + anchor (Auto ads, tắt in-page Auto ads); `chapter-top`, `home-top` thử sau khi có số liệu.

### Lượt xem và tag HOT

- Lượt xem hiển thị ở mọi nơi là số thật từ `view_events` (`getViewStats()` trong `lib/stories.ts`, cache theo request); thiếu RPC thì trang vẫn chạy, chỉ không có số. Định dạng `formatViews()` (1,2K / 3,4M) trong `lib/views.ts`.
- Trang công khai chỉ hiện số lượt xem khi truyện đạt `PUBLIC_VIEWS_MIN = 1000` lượt thật (`publicViews()`, áp ở server nên số nhỏ không có trong HTML); dưới ngưỡng thì ẩn (không có ô trên ảnh bìa, ô bảng trống, trang truyện không có dòng Lượt xem). Admin luôn thấy số chính xác. Không bao giờ hiển thị số ảo.
- Cách tính: mỗi lần mở trang truyện hoặc trang chương = 1 lượt (`track_view`); bỏ bot theo user-agent (gồm trình duyệt headless); cùng người (cookie `mxt_vid`) mở lại cùng trang trong 15 phút chỉ tính 1; quá 300 lượt/giờ từ một IP bị bỏ (cần `VIEW_IP_SALT`); tổng của truyện = trang truyện + mọi chương.
- `/admin/truyen`: cột **Tag** (HOT/NEW/FULL như trang chủ, `StoryTag`) + công tắc **Ghim HOT** từng dòng (`HotPinSwitch`); form đăng/sửa có ô “Gắn tag HOT” (`hot_pinned`, POST/PATCH `/api/admin/stories`). NEW = đăng trong `NEW_DAYS = 7` ngày, FULL = trạng thái Hoàn thành (tự động, `lib/views.ts`).
- HOT = admin ghim (`hot_pinned`) hoặc tự động: top `HOT_TOP = 5` lượt xem 7 ngày, tối thiểu `HOT_MIN_VIEWS_7D = 100`.
- Tìm kiếm có sắp xếp `luot-xem`.

### Quy tắc chính sách bắt buộc

- Không đặt quảng cáo sát nút chương trước/sau, menu, breadcrumb; không popup/interstitial tự làm (ngoại lệ do chủ dự án chọn: pop-up Shopee theo từng truyện, mục Shopee Affiliate); không sticky tự làm chiếm > 30% màn hình mobile.
- Không làm “xem quảng cáo để mở khóa chương” bằng AdSense (chỉ dùng Offerwall/rewarded chính thức của Google hoặc hệ thống xu/VIP riêng).
- Không hiển thị quảng cáo trên nội dung người lớn; Category Filter không thay thế được việc tắt quảng cáo.
- Không tạo lượt xem/click giả; không hiển thị số liệu ảo.
- Nội dung phải có quyền đăng; gỡ ngay truyện bị khiếu nại bản quyền (DMCA).

## 8b. Xu (tiền ảo) và khóa chương

Migration `0004_coins.sql`. 1 Xu = 100đ; gói nạp và nhãn trong `lib/coins.ts`.

- Khóa theo truyện: `stories.lock_from_chapter` (null = miễn phí) và `lock_price_coins` (mặc định 3). Giá chương = `chapter_price()` trong SQL, bản TS `chapterPrice()` chỉ để hiển thị.
- `wallets` (số dư ≥ 0), `coin_transactions` (sổ cái chỉ thêm, có `balance_after`), `chapter_unlocks`. Thành viên chỉ đọc dữ liệu của mình; **không có policy ghi** — mọi thay đổi số dư đi qua hàm security definer: `unlock_chapter()` (khóa dòng ví `for update`, idempotent), `admin_adjust_coins()` (chỉ role `admin`, bắt buộc lý do), nội bộ `apply_coin_change()` (đã revoke khỏi client).
- `chapters.text_url` **bị ẩn khỏi API công khai** (chỉ grant select các cột khác). Link nội dung lấy qua `chapter_text_url()` — chỉ trả khi chương miễn phí, đã mở khóa hoặc là admin. Không select `text_url` từ client/anon; chương khóa không tải và không render nội dung, không đặt quảng cáo.
- Route: `POST /api/coins/unlock`, `POST /api/admin/members/[id]/coins`, trang `/tai-khoan` (ví, lịch sử, chương đã mở), `/admin/thanh-vien` (RPC `admin_list_members()`).
- Chưa làm: nạp tự động (VietQR/SePay + MoMo doanh nghiệp, tài khoản công ty), R2 riêng tư cho file chương trả phí (file `.txt` hiện vẫn public trên R2 nếu đoán được đường dẫn).

## 8b2. Nhập truyện từ Cloudflare R2

Nút **Nhập từ Cloudflare** (`/admin/truyen`, `components/r2-import-dialog.tsx`): chọn thư mục trong bucket public (`R2_PUBLIC_BUCKET`) hoặc riêng tư (`R2_BUCKET`), liệt kê `.txt` qua S3 ListObjectsV2 (`lib/r2-browser.ts`, `aws4fetch`), sắp theo số trong tên file (`chapterNumberFromFile`), đọc tên chương từ 600 byte đầu (`chapterTitleFromText`). Thư mục trùng slug truyện đã có → chỉ thêm chương chưa có; ngược lại tạo truyện mới (bucket riêng tư mặc định khóa từ chương 1). Link lưu: URL public (mã hóa từng đoạn) hoặc `r2://key`.

- API: `GET /api/admin/r2/folders?source=public|private&prefix=`, `GET /api/admin/r2/preview?source=&prefix=<thư mục/>` (vai trò `content`).
- Cần `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (token R2 **Object Read & Write** — ghi cần cho chương tác giả và ảnh bìa); r2.dev public không liệt kê được thư mục. Thiếu khóa → API trả 503 và hộp hiện hướng dẫn.

## 8b3. Tải bản thảo (một file nhiều chương)

Nút **Tải bản thảo** ở `/admin/truyen` (truyện mới hoặc thêm vào truyện có sẵn) và ở trang truyện của tác giả (`components/manuscript-dialog.tsx`).

- Nhận `.docx` (Word, Google Docs tải về; đọc bằng `mammoth` trong trình duyệt, giữ Heading 1–6), `.pages` (Pages 5+ — `lib/pages.ts`: unzip `jszip`, giải nén Snappy `Index/Document.iwa`, đọc protobuf `TSWP.StorageArchive` type 2001 kind 0; ký tự ngắt trang U+0005 / ngắt mục U+0004 / ngắt cột tính là xuống đoạn; bản Pages cũ báo lưu lại), `.md`, `.txt` (UTF-8/UTF-16/Windows-1258), tối đa 20 MB; hoặc link Google Docs chia sẻ công khai qua `GET /api/manuscript/google-doc?url=` (chỉ lấy id, chỉ gọi docs.google.com, export docx ≤ 4 MB vì giới hạn response Vercel). `.doc` → hướng dẫn lưu lại thành .docx.
- Tách chương ở trình duyệt (`lib/manuscript.ts`, thuần, có thể test): dòng `Chương N…`/`CHƯƠNG XII - …`/`Chapter N` là ranh giới; `Hồi N` chỉ khi là heading; đoạn văn thường chỉ tính khi ngắn (≤ 120 ký tự sau số) và không gồm nhiều câu. Không có dòng nào khớp thì tách theo heading cấp cao nhất. Tên chương viết hoa chữ đầu (`sentenceCase`). Cảnh báo: thiếu/trùng số, chương < 300 chữ, đoạn trước chương 1 (không tải). Markdown: mỗi dòng là một đoạn.
- Nhiều file một lần (tối đa 50 file / 100 MB; chọn nhiều file, chọn thư mục `webkitdirectory`, hoặc kéo thả file/thư mục): admin gom thành nhiều truyện theo `fileStoryInfo()` — file trong thư mục → tên thư mục; `Tên truyện - Quyển/Tập/Phần/Chương N` → cùng truyện, xếp theo N; còn lại mỗi file một truyện. Nhãn trong ngoặc ở tên file/thư mục bị bỏ (`stripNameTags`: `[1 - 10]`, `[On Going]`, `(Full)`); nhãn dải số dùng để xếp thứ tự file; trong thư mục, tên file đầy đủ hơn (bắt đầu bằng tên thư mục) được dùng làm tên truyện. File không có dòng “Chương N” lấy số từ tên file (`chapterNumberFromName`). Mỗi nhóm: truyện mới (tên, tác giả — có tác giả/thể loại chung, trạng thái, thể loại) hoặc tự nhận “Thêm vào truyện có sẵn” khi trùng slug; chuyển file giữa nhóm / tách riêng; nút **Đánh số lại liên tục** khi các quyển đánh số lại từ 1 (tiếp sau chương cuối đã có). Tác giả: mọi file gộp vào truyện đang mở.
- Ảnh bìa ngay trong hộp tải bản thảo (admin): ô ảnh nhỏ ở đầu mỗi truyện, `CoverUploader` trong phần chi tiết; truyện mới gửi `cover_url` khi tạo, truyện có sẵn đổi ảnh thì PATCH sau khi tải.
- Màn xem trước: sửa tên, bỏ chọn chương; chương đã có trên web bị bỏ qua; ô **Miễn phí cả truyện** (xóa `lock_from_chapter`) theo từng truyện hoặc tất cả.
- Gửi theo lô (≤ 50 chương, ≤ 1,2 triệu ký tự) tới `POST /api/admin/stories/[id]/manuscript` hoặc `/api/author/stories/[id]/manuscript` (`lib/manuscript-storage.ts`): lưu R2 public đúng bố cục `<Tên truyện>/Chương N.txt` (truyện đã có file thì dùng lại thư mục cũ), nội dung `Chương N: Tên` + dòng trống + đoạn văn; **không ghi đè** chương/file đã có (HEAD trước khi PUT); kiểm duyệt từng chương (`moderateContent`). Tác giả: tối thiểu 200 ký tự, tin cậy + sạch → đăng ngay, còn lại `submitted`.
- Lưu ý: file chương ở bucket public có đường dẫn dễ đoán — chương thu Xu có thể bị đọc lén; kế hoạch: chuyển riêng chương trả phí sang bucket riêng tư cùng bố cục.

## 8c. Quy tắc bảo mật

- Link nội dung chương: `https://…` (public, host phải thuộc `R2_PUBLIC_URL`/`CHAPTER_TEXT_HOSTS`) hoặc `r2://đường-dẫn` (bucket R2 riêng tư, đọc bằng `aws4fetch` + `R2_*`). Luôn kiểm bằng `contentUrlError()` và đọc bằng `fetchChapterText()` (`lib/chapter-content.ts`). Chương trả phí nên dùng `r2://`.
- Xác thực 2 lớp: bật ở `/admin/cai-dat`; `requireAdmin()`/`guardAdminApi()` buộc `aal2`, DB cũng kiểm tra. Captcha Turnstile: `components/turnstile.tsx`, chỉ chạy khi có site key và phải bật cùng lúc trong Supabase Attack Protection.
- Lượt xem lưu `ip_hash` = SHA-256(`VIEW_IP_SALT`:IP) cắt 32 ký tự; không có salt thì không lưu IP.
- Truyện `ads_disabled` không tải AdSense và không hiện `AdSlot`.

- Redirect sau đăng nhập dùng `safeInternalPath()` (`lib/safe-redirect.ts`); không tự kiểm `startsWith("/")` vì `/\\evil.com` thành domain ngoài.
- File tải lên chỉ nhận qua endpoint server có kiểm quyền; kiểm nội dung file thật (header), không tin MIME/đuôi file; không bao giờ nhận SVG/HTML; tên file ngẫu nhiên.
- Mọi URL do admin nhập (ảnh bìa, audio, nội dung, affiliate) phải qua `validTextUrl()` (chỉ http/https) cả khi lưu lẫn khi render.
- Header bảo mật đặt trong `next.config.ts` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS). CSP chưa bật — cần thử cùng AdSense trước.
- Số dư, giá và quyền truy cập luôn do database quyết định; API không nhận giá/số dư từ client.
- `track_view` chỉ ghi lượt xem cho truyện có thật.

## 8d. Kiểm duyệt nội dung

- Lõi: `lib/moderation-core.ts` (`compileTerms`, `scanText` — so khớp theo ranh giới từ, chịu được dấu chấm/cách xen giữa như `c.h.ế.t`, chuẩn hóa NFC; `moderationDecision`, `maskText`, `MATURE_THRESHOLD = 2`), `lib/moderation.ts` (`getModerationTerms` cache 60s, `maskForReaders`, `moderateChapter(s)`), từ điển sửa ở `/admin/kiem-duyet`.
- Trang public che mọi từ trong từ điển (tên truyện, tên chương, nội dung). Chương quét lúc đăng: sạch → quảng cáo bật; dính từ mức ≥ 2 → quảng cáo tắt, chờ duyệt tay. Nhãn 18+ chỉ admin thấy.
- Tắt quảng cáo theo chương chỉ ẩn ô quảng cáo, nội dung vẫn hiển thị.
- Quét lại toàn web (migration `0011`): trigger trên `moderation_terms` ghi `moderation_state.terms_changed_at`; chương có `moderated_at` cũ hơn (hoặc null) là “chưa quét theo từ điển mới”. `lib/moderation-rescan.ts` (`rescanStatus`, `rescanBatch` 25 chương/lần, dùng service role vì cần `text_url`). Quy tắc: chương chưa duyệt → theo kết quả mới; chương `approved` → giữ quyết định, trừ khi xuất hiện từ mức ≥ 2 chưa có lúc duyệt → về `pending`, tắt QC; file không đọc được → chương đã duyệt giữ nguyên. Đóng dấu `moderated_at` ≥ `terms_changed_at` + 1ms để lệch đồng hồ không gây lặp.
- Giao diện: `components/moderation-rescan-panel.tsx` ở đầu `/admin/kiem-duyet` (số chương cũ, nút Quét lại toàn web, tiến độ, dừng, quét tiếp được); toast sau mỗi lần sửa từ điển có nút quét. API `GET/POST /api/admin/moderation/rescan` (vai trò `content`). Cron hằng đêm 02:00 giờ VN (`vercel.json`, `/api/cron/moderation-rescan`, cần `CRON_SECRET`), chạy tối đa ~45 giây/đêm.

## 8e. Tác giả thành viên

- Quy tắc ở `lib/author-rules.ts`: chia doanh thu mặc định `DEFAULT_REVENUE_SHARE = 70`% (admin chỉnh từng tác giả), tối thiểu `MIN_FREE_CHAPTERS = 5` chương miễn phí, giá tối đa `MAX_LOCK_PRICE = 20` Xu/chương, tin cậy sau `TRUST_THRESHOLD = 10` chương được đăng (chương sạch tự đăng; chưa tin cậy thì chờ admin duyệt), rút Xu mỗi tháng vào ngày `PAYOUT_DAY = 20`, tối thiểu `MIN_PAYOUT_COINS = 500`.
- Tác giả chỉ nhận Xu. Sửa chương đã đăng → gửi duyệt lại. Nội dung tác giả viết được lưu thành `.txt` trên R2 public với tên khó đoán (`uploadChapterText`).
- Helpers: `lib/authors.ts` (`getAuthorContext`, `guardAuthorApi`, `ownedStory`, `isTrustedAuthor`), `lib/author-stories.ts` (`parseAuthorStory`).

## 9. Thiết lập Supabase

Project hiện dùng: `aijhhoopjtxjtoyvugsz` (gói Free, tự tạm dừng sau ~1 tuần không hoạt động — vào dashboard bấm Restore nếu app báo `fetch failed`). Đã chạy `0001`–`0008` và có admin `admin@admin.com` (06/10/2026; mật khẩu tạm, cần đổi trước production).

Thiết lập project mới:

1. Lấy Project URL và Publishable key, điền vào `.env.local` (và Vercel).
2. Chạy lần lượt `0001` → `0008` trong SQL Editor, rồi `notify pgrst, 'reload schema';`.
3. Tạo admin trực tiếp (không qua đăng ký) — thay email/mật khẩu:

```sql
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'admin@admin.com';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'admin@admin.com',
      extensions.crypt('<mat-khau>', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"Admin"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'admin@admin.com', 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt('<mat-khau>', extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
  insert into public.admin_profiles (id, email, display_name, role, status)
  values (uid, 'admin@admin.com', 'Admin', 'admin', 'active')
  on conflict (id) do update set role = 'admin', status = 'active', updated_at = now();
end $$;
```

4. Bật Email provider; nếu dùng Google: bật Google provider, đặt callback `https://<project-ref>.supabase.co/auth/v1/callback` trong Google Cloud Console.
5. Redirect URLs: `http://localhost:3000/auth/callback`, `https://<vercel-domain>/auth/callback`.

## 10. Biến môi trường

`.env.example` chỉ chứa tên biến/placeholder; `.env.local` bị `.gitignore` bỏ qua.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only: đổi mật khẩu admin, API tác giả, dọn ảnh bìa

# Dev-only
ADMIN_AUTH_BYPASS=false

# Website / doanh nghiệp (hiện ở trang thông tin, chân trang)
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_COMPANY_NAME=
NEXT_PUBLIC_COMPANY_TAX_CODE=
NEXT_PUBLIC_COMPANY_ADDRESS=
NEXT_PUBLIC_CONTACT_EMAIL=
NEXT_PUBLIC_CONTACT_PHONE=

# Bảo mật
VIEW_IP_SALT=                       # chuỗi ngẫu nhiên để băm IP lượt xem
NEXT_PUBLIC_TURNSTILE_SITE_KEY=     # captcha đăng nhập/đăng ký (bật cùng Supabase Attack Protection)

# Cloudflare R2 (server-only trừ public URL)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=                   # token Object Read & Write
R2_SECRET_ACCESS_KEY=
R2_BUCKET=                          # bucket riêng tư (chương trả phí, r2://)
R2_PUBLIC_BUCKET=me-xem-truyen      # bucket public (chương, ảnh bìa covers/)
R2_PUBLIC_URL=https://pub-538f59c74bd24ae1b59dae832ad0c09b.r2.dev   # đổi sang tên miền riêng trước production
CHAPTER_TEXT_HOSTS=                 # host khác được phép làm link chương, cách nhau dấu phẩy

# Vercel Cron
CRON_SECRET=                        # chuỗi ngẫu nhiên, Vercel gửi kèm khi chạy job hằng đêm

# AdSense (public, gắn vào bundle lúc build — đổi phải redeploy)
NEXT_PUBLIC_ADS_ENABLED=false
NEXT_PUBLIC_ADS_PREVIEW=false       # true = hiện khung giữ chỗ để xem bố cục
NEXT_PUBLIC_ADSENSE_CLIENT=         # ca-pub-...
NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP=
NEXT_PUBLIC_ADSENSE_SLOT_HOME_FEED=
NEXT_PUBLIC_ADSENSE_SLOT_STORY=
NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_TOP=
NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_MID=
NEXT_PUBLIC_ADSENSE_SLOT_CHAPTER_END=
```

Publishable key dùng được ở browser nhưng dữ liệu phải được RLS bảo vệ. Không đặt service role key hay R2 secret vào Client Component, `NEXT_PUBLIC_*`, Git hoặc chat. Upload lên R2 chỉ qua endpoint server (kiểm quyền, nội dung file, kích thước, tên file ngẫu nhiên). `r2.dev` chỉ dành cho phát triển (giới hạn tốc độ, không cache CDN): trước production gắn tên miền riêng cho bucket (R2 → Settings → Custom Domains), đổi `R2_PUBLIC_URL`, rồi chạy SQL `replace()` đổi host cũ trong `stories.cover_url` và `chapters.text_url`. Runtime giữ Node.js (Vercel), không chuyển sang Workers.

## 11. Quy tắc phát triển

- Đọc `AGENTS.md` và tài liệu trong `node_modules/next/dist/docs/` trước khi viết code; Next.js 16 khác kiến thức cũ (`params`/`searchParams` là Promise, `proxy.ts` thay middleware, `RouteContext`/`PageProps` global).
- Không sửa public route khi thay đổi admin nếu không cần thiết.
- Dùng `next/link` cho điều hướng nội bộ (trừ link tải file từ API).
- Component có state/event handler phải có `"use client"`. Không dùng `window`, `document` hoặc secret server trong Server Component.
- Bảng admin responsive: `overflow-x-auto`, `min-w-0`, truncate.
- Nút icon có `aria-label`; form có label/error/loading state.
- Dữ liệu mock phải ghi rõ là mock; không gọi là realtime.
- Không commit `.env.local`, secret OAuth, service role key hoặc R2 secret.

## 12. Kiểm thử chuẩn

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Smoke test (`npm run dev`):

- `/`, `/dang-nhap`, `/admin/dang-nhap`, `/truyen/<slug>`, `/truyen/<slug>/chuong/<n>` trả 200.
- `/admin` chưa đăng nhập chuyển tới `/admin/dang-nhap` (khi không bật bypass); user thường không vào được; admin hợp lệ vào được.
- `POST /api/track/view` trả 204 với slug hợp lệ, 400 với slug sai; `/go/<id-không-tồn-tại>` redirect về `/`.
- Mặc định không trang nào có `adsbygoogle.js`; `NEXT_PUBLIC_ADS_PREVIEW=true` hiện khung giữ chỗ ở trang chủ/truyện/chương, không có ở đăng nhập/admin.
- `POST /api/admin/covers` và `/api/author/covers` chưa đăng nhập trả 401; file SVG/sai kích thước trả 400; bỏ ảnh bìa thì file trên R2 trả 404.
- `/tim-kiem?the_loai=a,b` (có tất cả) và `&che_do=mot-trong` (ít nhất một) cho kết quả đúng.
- Email login/register có loading và lỗi; Google OAuth chỉ redirect tới path nội bộ; R2 fail-closed khi thiếu credentials.

## 13. Trạng thái hiện tại

Đã hoàn thành:

- Giao diện public (sáng/tối, Raleway, bảng màu thương hiệu, header dùng chung, tìm kiếm nâng cao nhiều thể loại) và admin; dữ liệu thật từ Supabase.
- Supabase Auth (Email/Google), guard admin theo vai trò, xác thực 2 lớp, Turnstile (chờ key), bypass đăng nhập cho dev.
- Đăng/sửa/xóa truyện, thêm chương, import CSV, nhập từ thư mục Cloudflare R2, thể loại; tải và cắt ảnh bìa lên R2.
- Xu và khóa chương; kiểm duyệt nội dung (che từ, quét khi đăng, quảng cáo theo chương, 18+ cho admin); tác giả thành viên (duyệt, viết chương, chia doanh thu, rút Xu ngày 20).
- Tracking lượt xem/click affiliate, nhập báo cáo Shopee/AdSense, dashboard doanh thu, xuất CSV; component AdSense dựng sẵn (đang tắt), `ads.txt`; trang giới thiệu/điều khoản/bảo mật/liên hệ.

Chưa hoàn thành:

- Đổi mật khẩu admin tạm `admin@admin.com`.
- Tên miền: gắn tên miền riêng cho R2 (thay `r2.dev`) và cho website; deploy Vercel kèm biến môi trường (Supabase, service role, R2, `VIEW_IP_SALT`, thông tin công ty).
- Đẩy repo lên GitHub (chỉ khi chủ dự án đồng ý) để chạy `.github/workflows/supabase-keepalive.yml` / `supabase-backup.yml` (cần secrets).
- Nạp Xu tự động (VietQR/SePay + MoMo doanh nghiệp), bucket R2 riêng tư cho chương trả phí, tủ sách, gom lượt xem theo ngày, CSP.
- Khi lưu lượng lớn (vài nghìn người đọc/ngày), nâng giới hạn `track_view` từ 300 lên 1.000 lượt/giờ/IP (nhiều người dùng 4G chung IP) — không bỏ hẳn chặn cày view (chủ dự án đã đồng ý 08/10/2026).
- Đồng bộ tự động AdSense Management API và Shopee Affiliate API (hiện nhập CSV).
- Gắn link Shopee và bật AdSense trên trang public (khi chủ dự án yêu cầu).
