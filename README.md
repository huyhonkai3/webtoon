# Webtoon

Monorepo TypeScript: Next.js App Router, Express 5, PostgreSQL 17, Prisma 7.
Node.js 24 và npm workspaces. Đã hoàn thành bước 1 (dựng nền) và bước 2 (module series).

## Chạy project

Chạy tại thư mục gốc, cần Node.js 24 và Docker Compose v2:

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d --wait
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Bash: dùng `cp` thay cho `Copy-Item`. Nếu đã có file env, giữ cấu hình kết nối đang sử dụng.

- Web: http://127.0.0.1:3001
- API: http://127.0.0.1:4000/api/v1/series
- Database readiness: http://127.0.0.1:4000/health/ready

Nếu đã chạy bước 1, cập nhật code rồi chạy `npm ci`, `npm run db:deploy`, `npm run db:generate`.
Migration mới đổi tên cột `status` thành `publication_status` và thêm `cover_asset_id` nullable; giữ dữ liệu hiện có.

## Module series — bước 2

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/v1/series?page=1&pageSize=12` | Danh sách truyện công khai |
| GET | `/api/v1/series/:slug` | Chi tiết truyện công khai |
| POST | `/api/v1/admin/series` | Tạo truyện nháp, trả 201 và Location |
| GET | `/api/v1/admin/series/:id` | Xem cả bản nháp và truyện lưu trữ |
| PATCH | `/api/v1/admin/series/:id` | Sửa thông tin, slug hoặc trạng thái công khai |

API quản trị chỉ được mount khi `NODE_ENV=development` và `HOST=127.0.0.1`.
Server mặc định bind `127.0.0.1`; middleware còn kiểm tra địa chỉ socket loopback, không tin `X-Forwarded-For`.
Request có Origin phải khớp `WEB_ORIGIN`; CLI không cần Origin.
Production hoặc `HOST=0.0.0.0` không có các route quản trị (404). Đây là cơ chế tạm trước bước auth.

### Dữ liệu và validation

| Trường | Quy tắc |
| --- | --- |
| `title` | Bắt buộc khi tạo; trim, 1–200 ký tự |
| `slug` | Bắt buộc khi tạo; 1–220 ký tự; chữ thường ASCII, số, gạch nối giữa các từ; ví dụ `hanh-trinh-binh-minh` |
| `description` | Tùy chọn; trim, tối đa 20.000 ký tự; null để xóa |
| `coverAssetId` | Tùy chọn; UUID hoặc null |
| `publicationStatus` | Chỉ PATCH: DRAFT, PUBLISHED, ARCHIVED |

POST luôn tạo DRAFT. Client tự cung cấp slug; không tự sinh slug khi đổi title.
Slug unique trên toàn bộ truyện, kể cả DRAFT/ARCHIVED.
`publicationStatus` chỉ quyết định việc công khai; trạng thái đang ra/hoàn thành sẽ là trường riêng khi cần.

PATCH chỉ sửa trường được gửi; bỏ trường thì giữ nguyên, null chỉ hợp lệ cho description và coverAssetId.
Body rỗng, trường lạ, UUID/slug không hợp lệ trả 400.
`coverAssetId` hiện chỉ lưu UUID: module media sẽ bổ sung bảng asset, foreign key và kiểm tra asset tồn tại; bước này chưa upload hoặc trả URL ảnh.

Public list/detail chỉ đọc PUBLISHED. DRAFT, ARCHIVED và slug không tồn tại đều trả 404 ở endpoint chi tiết.
Response public không có publicationStatus.
Phân trang: page 1–100000, pageSize 1–50; sort createdAt DESC, id DESC.
Danh sách và tổng số được đọc trong cùng transaction RepeatableRead.
Không có truyện: data là [], total và totalPages bằng 0.

Response detail/admin có dạng `{ data: {...} }`; ngày giờ là chuỗi ISO.
Admin thêm publicationStatus; public detail thêm updatedAt so với summary.
Lỗi dùng `{ error: { code, message, requestId, details? } }` và header X-Request-Id.

| HTTP | Mã lỗi |
| --- | --- |
| 400 | VALIDATION_ERROR hoặc INVALID_JSON |
| 403 | LOCAL_ADMIN_ONLY |
| 404 | SERIES_NOT_FOUND hoặc NOT_FOUND |
| 409 | SERIES_SLUG_CONFLICT |
| 413 | PAYLOAD_TOO_LARGE |
| 500 | INTERNAL_ERROR |

Unique constraint ở database bắt cả request ghi đồng thời. Service nhận lỗi domain từ repository và chuyển thành 409.
PATCH thất bại do slug trùng không lưu một phần thay đổi.

### Thử luồng tạo → công khai → đọc bằng PowerShell

```powershell
$base = 'http://127.0.0.1:4000/api/v1'
$body = @{ title = 'Truyen thu nghiem'; slug = 'truyen-thu-nghiem' } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri "$base/admin/series" -ContentType 'application/json' -Body $body
$id = $created.data.id

# Ban nhap: public detail tra 404
Invoke-RestMethod -Uri "$base/admin/series/$id"

$patch = @{ publicationStatus = 'PUBLISHED'; description = 'Mo ta truyen' } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$base/admin/series/$id" -ContentType 'application/json' -Body $patch
Invoke-RestMethod -Uri "$base/series/truyen-thu-nghiem"
```

## Cấu trúc và luồng xử lý

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `apps/api/prisma` | Schema, migration, seed |
| `apps/api/src/modules/series/series.routes.ts` | Public router và admin router |
| `apps/api/src/modules/series/series.controller.ts` | Parse request bằng Zod, mã HTTP và Location |
| `apps/api/src/modules/series/series.service.ts` | Nghiệp vụ, 404/409, chọn trường response |
| `apps/api/src/modules/series/series.repository.ts` | Truy vấn Prisma, transaction, chuyển lỗi database |
| `apps/api/src/modules/series/series.errors.ts` | Lỗi domain của module |
| `apps/api/src/middleware` | Error handler và giới hạn local admin |
| `packages/contracts/src/index.ts` | Schema Zod và TypeScript type dùng chung |
| `apps/api/tests` | HTTP tests với repository giả và integration tests với database |
| `apps/web/src` | Danh sách truyện render từ server |

Luồng: route → controller → service → repository.
Router factory nhận repository từ app.ts; test có thể thay dependency.
server.ts kết nối database, bind HTTP và đóng tài nguyên khi nhận SIGINT/SIGTERM.

## Kiểm tra

```powershell
npm run check
$env:TEST_DATABASE_URL='postgresql://webtoon:webtoon_dev@localhost:5432/webtoon_test?schema=public'
npm run test:integration
```

Bash:

```bash
TEST_DATABASE_URL='postgresql://webtoon:webtoon_dev@localhost:5432/webtoon_test?schema=public' npm run test:integration
```

`npm run check` chạy lint, TypeScript, 19 HTTP test và production build.
Integration test áp dụng migration rồi kiểm tra vòng đời truyện, null/partial PATCH, slug unique,
ghi đồng thời, rollback khi trùng slug, ẩn bản nháp/lưu trữ, thứ tự ổn định và phân trang.

**Integration test xóa dữ liệu series trong database test.** Bắt buộc TEST_DATABASE_URL riêng với tên database kết thúc bằng _test.
Compose tạo webtoon_test ở lần khởi tạo volume đầu tiên; volume cũ cần tạo database test thủ công.
Workflow GitHub Actions dùng PostgreSQL 17 để chạy cả hai lệnh kiểm tra.

Khi sửa schema: `npm run db:migrate -- --name ten_thay_doi`, rồi `npm run db:generate`.
Khi áp dụng migration đã commit: `npm run db:deploy`.
Seed dùng upsert theo slug; chạy lại không tạo bản sao.

Đăng nhập, module media/upload ZIP, chương truyện và SEO trang đọc nằm ở các bước tiếp theo.
