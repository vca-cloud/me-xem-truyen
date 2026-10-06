# Mê Xem Truyện — Project Guide

## 1. Mục đích dự án

“Mê Xem Truyện” là nền tảng đọc truyện chữ trực tuyến xây dựng bằng Next.js App Router, kiếm tiền bằng **Google AdSense** và **Shopee Affiliate**. Ứng dụng phục vụ hai nhóm người dùng:

- Người đọc: tìm kiếm truyện, lọc thể loại, xem thông tin truyện, đọc chương, đăng nhập/đăng ký.
- Quản trị viên: theo dõi doanh thu và lưu lượng, quản lý truyện, link affiliate, thành viên, quản trị viên, thể loại và cài đặt.

Supabase là Auth/database; Cloudflare R2 lưu ảnh bìa và file nội dung chương `.txt`; ứng dụng deploy trên Vercel. Một số màn hình vẫn dùng dữ liệu mock (xem mục 12).

## 2. Công nghệ và cấu trúc

- Next.js 16 App Router, TypeScript strict, React 19, Tailwind CSS 4.
- shadcn/ui style base-nova; primitive trong `components/ui/`: `button.tsx`, `card.tsx`, `input.tsx`.
- Lucide React cho icon. Biểu đồ dựng bằng CSS/Tailwind, không dùng thư viện chart.
- `@supabase/supabase-js`, `@supabase/ssr`.
- Path alias `@/*` trỏ tới thư mục gốc. Mã nguồn đặt trực tiếp tại root; không tạo thư mục dự án lồng nhau.

```text
app/                  # Routes, layouts, route handlers
components/           # UI dùng chung, admin shell, ads, tracking
components/ui/        # Primitive shadcn/ui
lib/                  # Supabase clients, auth, analytics, ads, import, mock data
supabase/migrations/  # SQL schema/RLS migrations (chạy theo thứ tự số)
public/               # Static assets
```

## 3. Các route hiện có

### Public

- `/` — trang chủ: truyện mới đăng, mới cập nhật, hoàn thành, danh sách có lọc thể loại/tìm kiếm/phân trang (dữ liệu thật từ `stories`).
- `/truyen/[slug]` — giới thiệu truyện và danh sách chương (`?thu_tu=moi` để xếp mới → cũ); slug không tồn tại trả 404.
- `/truyen/[slug]/chuong/[chapterNumber]` — đọc chương; nội dung lấy từ `text_url` (file `.txt` public trên R2).
- `/dang-nhap`, `/dang-ky` — email/password hoặc Google.
- `/auth/callback` — OAuth callback, đổi code thành session.
- `/go/[id]` — redirect affiliate: ghi click rồi chuyển 302 tới link Shopee (`?s=<slug>&c=<chương>`).
- `/ads.txt` — sinh từ `NEXT_PUBLIC_ADSENSE_CLIENT`; trả 404 khi AdSense chưa bật.
- `POST /api/track/view` — ghi lượt xem (gọi từ `components/view-tracker.tsx`).

### Admin

- `/admin/dang-nhap` — đăng nhập quản trị (ngoài protected route group).
- `/admin` — dashboard doanh thu & theo dõi.
- `/admin/truyen` — đăng truyện, thêm chương, sửa thông tin (tên truyện cố định để giữ link), xóa, import CSV; dữ liệu thật.
- `/admin/affiliate` — quản lý link Shopee, nhập báo cáo đơn hàng Shopee và AdSense.
- `/admin/thanh-vien`, `/admin/quan-tri-vien`, `/admin/the-loai`, `/admin/cai-dat`.

API admin: `/api/admin/stories` (POST đăng truyện), `/api/admin/stories/[id]` (PATCH sửa, DELETE xóa), `/api/admin/stories/[id]/chapters` (POST thêm chương), `/api/admin/stories/import`, `/api/admin/affiliate-links[/id]`, `/api/admin/revenue/import`, `/api/admin/analytics/export`, `/api/admin/administrators/[id]/password`. Mọi route admin gọi `requireAdmin()` ở server.

## 4. Giao diện đã triển khai

### Trang chủ

- Server component `app/page.tsx` tải truyện, client component `components/home-page.tsx` hiển thị.
- Sticky header với logo, tìm kiếm tên truyện/tác giả, đăng nhập/đăng ký, chuyển sáng/tối.
- Section truyện mới đăng (cover 4:5, nhãn NEW trong 7 ngày, FULL khi hoàn thành), mới cập nhật (bảng), truyện hoàn thành; ẩn section trống.
- Danh sách truyện có lọc thể loại, phân trang 10 truyện/trang; badge thể loại ôm sát nội dung, truncate text.
- Cover/tên truyện liên kết tới `/truyen/[slug]`.

### Trang chi tiết truyện

- Breadcrumb dạng `Trang chủ › Tên truyện`.
- Ảnh bìa (`cover_url`), tác giả, thể loại, trạng thái, tổng chương, ngày cập nhật. Không hiển thị rating/lượt đọc/nhãn HOT khi chưa có dữ liệu thật.
- Nút đọc từ đầu, đọc mới nhất, Mê Nghe Truyện, tủ sách (đang tắt — chưa làm); mô tả và danh sách chương.

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
   - `track_view(...)` — public, security definer; khử trùng cùng visitor/truyện/chương trong 30 phút.
   - `track_affiliate_click(...)` — public; trả link đích nếu link đang bật; khử trùng 1 phút.
   - `admin_revenue_dashboard(p_from date, p_to date)` — chỉ admin; trả JSON tổng hợp cho dashboard.

Bảng còn có thể bổ sung sau: thành viên/tủ sách, cờ truyện nhạy cảm (`stories`) để tắt quảng cáo.

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
- Chưa gắn link Shopee lên trang public — chỉ làm khi chủ dự án yêu cầu.

### AdSense

- Báo cáo nhập bằng CSV `date,ad_unit,page_views,impressions,clicks,earnings` (upsert theo ngày + ad unit). Tên ad unit trên AdSense nên trùng cột `ad_unit`.
- Component dựng sẵn nhưng **tắt**: `lib/ads.ts` (cấu hình vị trí, chia quảng cáo giữa chương ~900 chữ, tối đa 3, không đặt trong 300 chữ cuối), `components/ads.tsx` (`AdSenseScript`, `AdSlot`), `app/ads.txt/route.ts`.
- Vị trí: `home-top`, `home-feed`, `story-detail`, `chapter-top`, `chapter-mid` (in-article), `chapter-end` (multiplex, cách nút chuyển chương). Mỗi vị trí chỉ hiện khi có slot id riêng.
- `AdSlot` chừa sẵn chiều cao, có nhãn “Quảng cáo”, lazy load bằng IntersectionObserver, `data-adtest` ngoài production, hỗ trợ `disabled` cho truyện nhạy cảm.
- Chỉ đặt `AdSenseScript`/`AdSlot` trên trang chủ, trang truyện, trang chương có nội dung — không đặt ở trang đăng nhập, admin, lỗi hoặc chương trống.
- Khởi đầu đề xuất: giữa chương + cuối chương + anchor (Auto ads, tắt in-page Auto ads); `chapter-top`, `home-top` thử sau khi có số liệu.

### Quy tắc chính sách bắt buộc

- Không đặt quảng cáo sát nút chương trước/sau, menu, breadcrumb; không popup/interstitial tự làm; không sticky tự làm chiếm > 30% màn hình mobile.
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

## 8c. Quy tắc bảo mật

- Redirect sau đăng nhập dùng `safeInternalPath()` (`lib/safe-redirect.ts`); không tự kiểm `startsWith("/")` vì `/\\evil.com` thành domain ngoài.
- Mọi URL do admin nhập (ảnh bìa, audio, nội dung, affiliate) phải qua `validTextUrl()` (chỉ http/https) cả khi lưu lẫn khi render.
- Header bảo mật đặt trong `next.config.ts` (nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS). CSP chưa bật — cần thử cùng AdSense trước.
- Số dư, giá và quyền truy cập luôn do database quyết định; API không nhận giá/số dư từ client.
- `track_view` chỉ ghi lượt xem cho truyện có thật.

## 9. Thiết lập Supabase

Project hiện dùng: `aijhhoopjtxjtoyvugsz` (gói Free, tự tạm dừng sau ~1 tuần không hoạt động — vào dashboard bấm Restore nếu app báo `fetch failed`). Đã chạy `0001`–`0003` và có admin `admin@admin.com` (06/10/2026; mật khẩu tạm, cần đổi trước production).

Thiết lập project mới:

1. Lấy Project URL và Publishable key, điền vào `.env.local` (và Vercel).
2. Chạy lần lượt `0001`, `0002`, `0003` trong SQL Editor, rồi `notify pgrst, 'reload schema';`.
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
SUPABASE_SERVICE_ROLE_KEY=          # server-only, cho đổi mật khẩu admin

# Dev-only
ADMIN_AUTH_BYPASS=false

# Cloudflare R2 (server-only trừ public URL)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=https://pub-538f59c74bd24ae1b59dae832ad0c09b.r2.dev

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

Publishable key dùng được ở browser nhưng dữ liệu phải được RLS bảo vệ. Không đặt service role key hay R2 secret vào Client Component, `NEXT_PUBLIC_*`, Git hoặc chat. R2 public URL chỉ đọc; upload tương lai dùng presigned URL/endpoint server, giới hạn MIME, kích thước, extension, path. Runtime giữ Node.js (Vercel), không chuyển sang Workers.

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
- Email login/register có loading và lỗi; Google OAuth chỉ redirect tới path nội bộ; R2 fail-closed khi thiếu credentials.

## 13. Trạng thái hiện tại

Đã hoàn thành:

- Giao diện public và admin, responsive admin shell; trang chủ/truyện/chương đọc dữ liệu thật từ Supabase.
- Supabase clients, session proxy, Email/Google Auth, guard admin theo role, bypass đăng nhập cho dev.
- Đăng truyện, thêm chương, sửa thông tin, xóa truyện, import CSV nhiều truyện nhiều chương, lưu thể loại.
- Nền tảng tracking: lượt xem, click affiliate, đơn Shopee, báo cáo AdSense; dashboard doanh thu và xuất CSV.
- Quản lý link affiliate; component AdSense dựng sẵn (đang tắt), `ads.txt`.

Chưa hoàn thành:

- Đổi mật khẩu admin tạm; thêm `SUPABASE_SERVICE_ROLE_KEY` nếu cần đổi mật khẩu từ trang admin.
- Thành viên, thể loại, quản trị viên (sửa/xóa), cài đặt vẫn là mock hoặc chỉ lưu trong phiên; chưa có tủ sách; chưa xóa/sửa từng chương.
- `components/admin-resource-page.tsx` còn nhánh `stories` cũ không dùng (trang truyện đã chuyển sang `components/admin-stories-page.tsx`).
- Cờ truyện nhạy cảm để tắt quảng cáo; trang giới thiệu/chính sách/liên hệ (cần cho duyệt AdSense).
- Đồng bộ tự động AdSense Management API và Shopee Affiliate API (hiện nhập CSV).
- Gắn link Shopee và bật AdSense trên trang public (khi chủ dự án yêu cầu).
- R2 presigned upload; biến môi trường và deploy trên Vercel.
- README vẫn là mặc định của `create-next-app`. Repo chưa có commit nào.
