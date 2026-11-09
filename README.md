# NestJS API Skeleton

A production-ready, feature-rich NestJS API skeleton that accelerates backend development. Built with TypeScript, Prisma ORM, and following best practices for enterprise-grade applications.

## 📋 Table of Contents

- [What is This?](#-what-is-this)
- [Why Use This Skeleton?](#-why-use-this-skeleton)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [Core Modules](#-core-modules)
- [Built-in Features](#-built-in-features)
- [Usage Examples](#-usage-examples)
- [Development Guide](#-development-guide)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Best Practices](#-best-practices)
- [License](#-license)

---

## 🎯 What is This?

This is a **comprehensive NestJS API skeleton** designed to eliminate repetitive boilerplate work when starting new backend projects. Instead of building authentication, authorization, logging, file storage, and other common features from scratch, you get a production-ready foundation that follows industry best practices and NestJS conventions.

Think of it as a **starter kit on steroids** - it's not just a basic template, but a fully-functional backend with enterprise-level features already implemented and ready to extend.

---

## 💡 Why Use This Skeleton?

### Save Development Time
- **Skip weeks of setup work** - Authentication, authorization, file handling, logging, and more are ready to use
- **Pre-configured architecture** - Modular structure, clean separation of concerns, and scalable design
- **Battle-tested patterns** - Implements proven architectural patterns and best practices

### Production-Ready Features
- ✅ **Complete Authentication System** - Login, rotating refresh tokens, per-device sessions, password management, profile updates
- ✅ **Secure Password Reset** - OTP-based forgot password with attempt limits, rate limiting and email verification
- ✅ **Rate Limiting & Caching** - Redis-backed per-IP rate limits and permission cache
- ✅ **Role-Based Access Control (RBAC)** - Granular permissions system with admin groups and module rules
- ✅ **Multi-Storage Support** - Local, AWS S3, and Huawei OBS storage out of the box
- ✅ **Comprehensive Logging** - System logs and error logs with request tracking
- ✅ **Email Integration** - Templated emails with Handlebars
- ✅ **Validation & Error Handling** - Translated validation messages and standardized responses
- ✅ **Database Seeding** - Pre-built seed data for quick development

### Developer Experience
- 🚀 **TypeScript Throughout** - Full type safety and IntelliSense
- 📦 **Prisma ORM** - Modern database toolkit with type-safe queries
- 🎨 **Clean Architecture** - Organized module structure with clear boundaries
- 🔧 **Utility Helpers** - AES-256-GCM encryption, password hashing, date formatting, and more
- 🧪 **Testable by Design** - Prisma injected through DI, so services are unit-tested with mocks
- 📝 **Consistent Patterns** - Standardized response formats and error handling

### Extensibility
- **Modular Design** - Add new features without touching existing code
- **Plug-and-Play Modules** - Core modules (Banner, FAQ, User Management) ready to use or remove
- **Flexible Configuration** - Environment-based configuration for all features

---

## ✨ Key Features

### Authentication & Security
- JWT access tokens + rotating refresh tokens, grouped into per-device sessions
- Refresh tokens, OTPs and reset tokens stored only as SHA-256 hashes
- Reused refresh tokens are detected and end the whole session
- Logout, password reset/change and account deletion revoke sessions
- Secure password hashing with bcrypt
- Redis-backed rate limiting (global default + per-route `@RateLimit()`)
- Environment variables validated at startup
- **OTP-based password reset** - Configurable length, attempt limit, email delivery

### Authorization & Access Control
- **Module-based permissions** - Fine-grained control over admin actions
- **Admin Groups** - Organize admins into groups with specific access rights
- **Module Rules** - Define granular permissions per module (View List, Add New, Edit, Delete, …)
- **Declarative checks** - `@RequireModule()` / `@RequireRule()` + `PermissionsGuard` (403 when denied)
- **Cached permissions** - Stored in Redis, refreshed automatically when RBAC data changes

### File Storage
- **Multi-provider support** - Switch between Local, AWS S3, or Huawei OBS
- **Smart filename handling** - Automatic sanitization and normalization
- **Flexible upload options** - Custom names, folders, and identifiers
- **Pre-signed URL support** (for S3/OBS)

### Logging & Monitoring
- **System Activity Logs** - Track all admin actions with before/after values
- **Error Logs** - Automatic error tracking with stack traces and context
- **Request Tracking** - IP address, user agent, and endpoint logging
- **Configurable logging** - Enable/disable via environment variables

### Email System
- **Template-based emails** - Use Handlebars templates for branded emails
- **Two senders** - `MailRelayService` (Marley, the office HTTP mail relay; used by admin forgot-password) or `MailService` (SMTP with TLS)
- **Relay request log** - Every Marley call is saved to `mail_relay_logs`, token masked and attachment content left out
- **Async email sending** - Non-blocking email operations
- **Built-in templates** - Forgot password OTP, register OTP and reset-password link

### Validation & Error Handling
- **Translated validation messages** - English and Indonesian out of the box
- **Custom validation pipe** - Automatic DTO validation with whitelisting
- **UUID validation** - Malformed ids rejected with a 422 before reaching the database
- **Standardized responses** - `ResponseInterceptor` and `GlobalExceptionFilter` build one envelope format
- **Automatic error logging** - Server errors logged to database

### Utilities & Helpers
- **Data encryption/decryption** - AES-256-GCM (`encryptPayload` / `decryptPayload`)
- **Password utilities** - Hashing and comparison with bcrypt
- **Date formatting** - Timezone-aware date/time handling (dayjs)
- **Token helpers** - Secure OTP/token generation and hashing
- **API docs** - OpenAPI spec with a Scalar reference UI (non-production)

---

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) v12.x (the NestJS 11 version is release `v1.0.0` / branch `release/nest-11`)
- **Language**: TypeScript 6.0
- **Runtime**: Node.js 24 (CI and Docker image)
- **ORM**: [Prisma](https://www.prisma.io/) v7.x with the `pg` driver adapter
- **Database**: PostgreSQL
- **Cache / rate limiting**: Redis (ioredis), single node or cluster — optional, in-memory fallback
- **Authentication**: JWT with @nestjs/jwt
- **File Storage**: AWS S3, Huawei OBS, or Local
- **Email**: Marley HTTP mail relay or Nodemailer (SMTP), with Handlebars templates
- **Validation**: class-validator & class-transformer
- **Logging**: pino (nestjs-pino) with request correlation ids
- **Health checks**: @nestjs/terminus
- **API docs**: @nestjs/swagger + Scalar
- **Testing**: Jest 30

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.19+ (24 recommended — matches CI and the Docker image)
- **npm**
- **PostgreSQL** 13+
- **Redis** 6+ — optional. Without it the app uses an in-memory store (fine for a single instance)
- **Git**

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#-configuration) section).
At minimum set `DATABASE_URL` and a `JWT_SECRET_KEY` of 32+ characters
(`openssl rand -hex 32`) — the app refuses to start without them.

### 4. Set Up Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database (optional but recommended)
npx prisma db seed
```

### 5. Build the Application

```bash
npm run build
```

---

## ⚙️ Configuration

Edit your `.env` file (start from `.env.example`). All variables are validated
at startup (`src/common/config/env.validation.ts`); a missing or malformed
value stops the app with a list of what is wrong.

**Value formats**
- **On/off settings** — `SYSTEM_LOG`, `ERROR_LOG`, `DISABLE_RATE_LIMIT`,
  `EXECUTE_CRON`, `SMTP_SECURE`: only `true` turns them on, in any case
  (`true`, `TRUE`, `True`). Anything else — `false`, `1`, `yes`, empty or
  unset — means off. (Exceptions: `MAIL_SERVICE_ENABLED` is on when unset or
  empty; `CDN_TOKEN_AUTH_ENABLED` also accepts `1`
  and `yes`.)
- **Empty values** (`KEY=`) count as unset and fall back to the default.
- **Numbers** (`APP_PORT`, `SMTP_PORT`, `REDIS_PORT`, `OTP_*`, …) must be
  whole numbers; `SMTP_PORT=abc` stops startup instead of becoming `NaN`.
- **Comments** go on their own line. `docker run --env-file` keeps an inline
  `# ...` as part of the value, so `SYSTEM_LOG=true # note` would read as off.

### Database
```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

### Server
```env
APP_PORT=3003
APP_URL="http://localhost:3003"   # used to build local file URLs
APP_ENV="development"             # development | staging | production | test
APP_TIMEZONE="Asia/Jakarta"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"  # CORS for web clients
```
With `APP_ENV=production` the API docs are not exposed and logs are plain JSON.

### JWT
```env
JWT_SECRET_KEY="..."               # Required, ≥32 chars: openssl rand -hex 32
JWT_EXPIRATION_TIME="30m"          # Access token lifetime
REFRESH_TOKEN_EXPIRATION_TIME="3d" # Refresh token (session) lifetime
```

### Reverse Proxy
```env
TRUST_PROXY=1   # Proxy hops in front of the app (1 = single nginx); false if none
```
Controls which address `request.ip` resolves to — used for rate limiting and
logs. Behind nginx it must be set, or every client shares nginx's IP.

### Redis & Rate Limiting
Redis is optional. Leave `REDIS_HOST` and `REDIS_HOSTS` empty to run without
it: rate limiting, the permission cache, the maintenance flag and upload-expiry
cleanup then use an in-memory store with the same behaviour. That state is per
process, so with several replicas (including the brief blue/green overlap) use
Redis. `/healthz/ready` reports `redis.mode` as `single`, `cluster` or `memory`.

```env
REDIS_HOST=localhost                  # empty = no Redis (in-memory store)
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
# REDIS_HOSTS=node1:6379,node2:6379   # cluster mode instead of HOST/PORT
DISABLE_RATE_LIMIT=false              # true to switch rate limiting off locally
```
Default limit is 200 requests / 60 s per IP; sensitive routes use stricter
`@RateLimit(route, limit, windowSeconds)` values (e.g. login: 5 per 5 min).

### OTP (Password Reset)
```env
OTP_LENGTH=6                # Digits per OTP (4–10)
OTP_EXPIRE_MINUTES=5
OTP_RESEND_DELAY_SECONDS=60
OTP_MAX_ATTEMPTS=5          # Wrong guesses before the OTP is invalidated
```

### Email (Marley relay)
Used by `MailRelayService`, which sends `POST {MAIL_SERVICE_URL}/send-mail`
with `Authorization: Bearer {MAIL_VAULT_TOKEN}` (15 s timeout).

| `MAIL_SERVICE_ENABLED` | Staging / production boot | Sending |
|---|---|---|
| `true` (default) | Needs `MAIL_SERVICE_URL` and `MAIL_VAULT_TOKEN` | Through Marley |
| `false` | Starts without them | Skipped, with a warning in the log |

Set it to `false` for projects that don't use Marley. Admin forgot-password
sends through `MailRelayService`, so with it off no OTP email goes out: a
project that sends over SMTP should inject `MailService` in the admin auth
module instead.

`MAIL_SERVICE_URL` has no default. While the relay is on, outside staging and
production, an unset URL makes sends fail with "MAIL_SERVICE_URL is not set".
Use Marley's real address: inside the Docker image, `localhost:4000` is this
app itself.
```env
MAIL_SERVICE_ENABLED=true
MAIL_SERVICE_URL=http://localhost:4000
MAIL_VAULT_TOKEN=your-mail-vault-bearer-token
```

### Email (SMTP)
Only used by `MailService`.
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME="Your App Name"
SMTP_SECURE=false  # true for port 465, false for other ports
```

### Storage
```env
DISK_STORAGE=local  # Options: local, s3, obs

# AWS S3 (DISK_STORAGE=s3)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name

# Huawei OBS (DISK_STORAGE=obs)
OBS_ACCESS_KEY_ID=your-access-key
OBS_SECRET_ACCESS_KEY=your-secret-key
OBS_ENDPOINT=obs.ap-southeast-1.myhuaweicloud.com
OBS_BUCKET_NAME=your-bucket-name
OBS_DOMAIN_NAME=your-bucket-name.obs.ap-southeast-1.myhuaweicloud.com
OBS_SIGNED_URL_EXPIRES=300
```
The selected provider's credentials are required at startup: with
`DISK_STORAGE=obs` or `s3`, a missing key stops the app with a clear error
instead of failing on the first upload.
Optional Huawei CDN token auth (`CDN_TOKEN_*`) is documented in `.env.example`.

### Logging, Encryption, Cron, Push
```env
SYSTEM_LOG=true        # Write admin actions to the logs table
ERROR_LOG=true         # Write 5xx errors to the error_logs table
ENCRYPT_SECRET_KEY=    # Optional, 64 hex chars for encryptPayload(): openssl rand -hex 32
EXECUTE_CRON=false     # true on the single replica that runs scheduled jobs (src/core/cron)
FIREBASE_PROJECT_ID=   # Only if you use PushNotificationModule
```

---

## 🗄️ Database Setup

### Prisma Schema

The skeleton includes a comprehensive Prisma schema with the following models:

- **Admin** - Admin users with authentication
- **AdminRefreshToken** - Refresh token management
- **AdminResetPassword** - OTP and password reset token management
- **AdminGroup** - Admin role groups
- **AdminGroupMember** - Admin group membership
- **AdminGroupAccess** - Permission mappings
- **Module** - Application modules
- **ModuleRule** - Granular permissions
- **User** - Regular users
- **Banner** - Banner/slide management
- **FAQ** - Hierarchical FAQ system
- **ErrorLog** - Error tracking
- **Log** - System activity logging
- **LogDetail** - Log action definitions

### Migrations

Run migrations to set up your database:

```bash
# Development
npx prisma migrate dev --name init

# Production
npx prisma migrate deploy
```

### Seeding

Seed the database with default data:

```bash
npx prisma db seed
```

This will create:
- Admins `superadmin` and `admin`, and a sample user
- Admin groups `*root` (full access) and `Admin` (granted every module rule)
- Modules (Admin, User, Admin Group, Module, Module Rule, Banner, FAQ, Global Config Management)
  with rules: View List, View Details, Add New, Edit, Delete, Restore
- Log action definitions and global config defaults

**Default Admin Credentials** (from seed):
```
superadmin / Admin123!   → member of *root, can do everything
admin      / Admin123!   → no group yet; assign one (e.g. Admin) before it can access anything
```
> ⚠️ **Important**: Change these credentials immediately in production!

**Password Reset Table**: `admin_reset_passwords` tracks OTP requests and reset tokens:
- OTP and reset token stored as SHA-256 hashes, with expiry timestamps
- `failedAttempts` counter for the per-OTP guess limit
- Resend timestamps for the resend delay
- Soft deletes for an audit trail

---

## 🏃 Running the Application

### Development Mode (with hot reload)
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

The API will be available at `http://localhost:3003` (or your configured `APP_PORT`).

- **API docs** (not in production): `GET /docs` (Scalar UI), `GET /docs-json` (OpenAPI spec)
- **Liveness**: `GET /healthz` → `{ "status": "ok" }`
- **Readiness**: `GET /healthz/ready` → database + Redis status incl. `mode` (terminus format; 503 when a dependency is down)

---

## 📁 Project Structure

```
.
├── .github/
│   ├── ci.env                  # CI/CD settings (DOCKER_ENABLED, SWR_ORG, IMAGE_NAME, DEPLOY_DIR)
│   └── workflows/              # ci.yaml, ci-config.yaml, deploy.yaml
├── deploy/                     # Production compose file, blue/green deploy.sh, deployment guide (README.md)
├── prisma/
│   ├── migrations/             # Database migrations
│   ├── seed/                   # Seed files for each model
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Main seed file (run with tsx)
├── mails/                      # Email templates (Handlebars)
├── src/
│   ├── common/                 # Shared code across modules
│   │   ├── auth/               # AuthCoreModule (JWT config), AdminAccessService (permission cache)
│   │   ├── config/             # Env validation, logger, image settings
│   │   ├── constants/          # Error/success/validation messages, field names, log actions
│   │   ├── decorators/         # @RequireModule/@RequireRule, @RateLimit, @ResponseMessage, @RawResponse
│   │   ├── helpers/            # Token, crypto, date, message helpers
│   │   ├── http/               # Paginated result type
│   │   ├── interceptors/       # ResponseInterceptor, form-body parsing
│   │   ├── maintenance/        # @UnderMaintenance(), MaintenanceGuard (503 per platform)
│   │   ├── services/           # Storage (local/S3/OBS), Redis, error log, push notifications
│   │   └── swagger/            # Shared OpenAPI response schemas
│   ├── core/cron/              # CronModule: scheduled jobs, loaded only when EXECUTE_CRON=true
│   ├── core/admin/             # Feature modules (auth, admin-account, admin-group, banner,
│   │                           #   faq, global-config, module, module-rule, option, user-account)
│   ├── filters/                # GlobalExceptionFilter
│   ├── generated/prisma/       # Generated Prisma client (git-ignored)
│   ├── guards/                 # AdminAuth, UserAuth, Permission, RateLimit guards
│   ├── health/                 # /healthz/ready
│   ├── mail/                   # Email service
│   ├── models/                 # Injectable query classes + ModelsModule
│   ├── pipes/                  # TranslatedValidationPipe, UuidPipe
│   ├── prisma/                 # PrismaService + PrismaModule
│   ├── public/uploads/         # Local uploads (DISK_STORAGE=local)
│   ├── response/               # Serves local upload files
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # HelperService
│   ├── app.module.ts           # Root application module
│   ├── app.setup.ts            # HTTP setup (trust proxy, CORS, validation) shared with e2e tests
│   └── main.ts                 # Application entry point
├── test/                       # E2E tests (platform, auth, RBAC) + setup helpers
└── Dockerfile                  # Multi-stage production image
```

### Key Directories Explained

#### `/src/common`
Shared functionality used across modules — configuration, constants, decorators,
helpers, interceptors and shared services (storage, Redis, error logging).

#### `/src/core/admin`
Business logic modules — each represents a feature:
- Self-contained with controller, service, DTOs and entities (Swagger models)
- Can be removed if not needed (also remove it from `app.module.ts`)
- Follow a consistent structure

#### `/src/models` and `/src/prisma`
`PrismaService` is the single database client, provided globally. Models are
`@Injectable()` query classes over it, registered in `ModelsModule`, so any
service can inject them — and tests can replace them with mocks.

#### `/src/guards`
- `AdminAuth.guard.ts` - Verifies the admin JWT and that its session (`sid`) is still live
- `UserAuth.guard.ts` - Same for end users (ready for user-facing routes)
- `Permission.guard.ts` - Enforces `@RequireModule()` / `@RequireRule()`
- `RateLimit.guard.ts` - Global per-IP rate limiting (Redis)

#### `/src/utils`
- `helper.service.ts` - Password hashing/validation, date formatting, file URLs, audit logging

---

## 🔧 Core Modules

All admin modules live under `src/core/admin/`. Every route except `/auth/*`,
`/response/*`, `/healthz*` and `/` requires `Authorization: Bearer <token>`.

### 1. Authentication (`auth`)
**Features**: login, rotating refresh tokens, per-device sessions, profile and
avatar updates, password change, OTP-based password reset, logout.

**Endpoints**:
- `POST /auth` - Login (5 attempts / 5 min per IP)
- `POST /auth/refresh-token` - Exchange a refresh token for new tokens
- `POST /auth/logout` - End the session the refresh token belongs to
- `GET /auth/profile` - Current admin profile
- `POST /auth/profile` - Update profile
- `POST /auth/change-avatar` - Upload a new avatar
- `POST /auth/change-password` - Change password (signs out other sessions)
- `POST /auth/forgot-password` - Email an OTP
- `POST /auth/verify-otp` - Exchange the OTP for a reset token
- `POST /auth/reset-password` - Set a new password (signs out every session)

### 2. Admin Account (`admin-account`) — `/admin-account`
CRUD for admins with pagination, sorting and search; group assignment; avatar
upload; soft delete/restore (deleting or deactivating an admin revokes their sessions).

### 3. Admin Group (`admin-group`) — `/admin-group`
Group management and module-rule assignment. Changes refresh the permission cache.
An update without `moduleRuleIds` keeps the group's rules; send `[]` to clear them.

### 4. User Account (`user-account`) — `/user-account`
CRUD for end users, avatar upload, soft delete/restore.

### 5. Banner (`banner`) — `/banner`
Banners with image/video upload, sorting, active status, CSV/XLSX export and
import. Position 1 in sorting is the top of the list; deleted banners don't
count, and a restored banner goes to the end. Imports are **all-or-nothing**
(every row is validated first, then inserted in one transaction), up to 5,000
rows; `urlTarget` must be an http(s) URL or an app path like `/promo/1`.

### 6. FAQ (`faq`) — `/faq`
Hierarchical FAQs (parent/child) with sorting. Deleting a FAQ soft-deletes its
whole subtree; restoring it brings back what was deleted together (a child
can't be restored while its parent is deleted). List filter `parentId`: omit for
every level, `null` for root level, or an id for that FAQ's children. A FAQ
can't be moved under itself or its own descendants, nor under a deleted parent;
when moved, its level is recomputed and it goes to the end of the new parent's list.

### 7. Module & Module Rule (`module`, `module-rule`) — `/module`, `/module-rule`
The RBAC catalogue: modules and their permission rules.

### 8. Global Config (`global-config`) — `/admin/global-config`
Key/value settings such as `IS_MOBILE_MAINTENANCE` / `IS_WEBSITE_MAINTENANCE`
(see [Maintenance Mode](#maintenance-mode)).

### 9. Option (`option`) — `/option`
Lookup lists for forms (admin groups, module rules) for any signed-in admin.

### 10. Response (`response`) — `/response/:fileName`
Serves locally stored uploads (`DISK_STORAGE=local`). Only files under
`src/public/uploads` are reachable; anything else returns 404.

---

## 🎯 Built-in Features

### Role-Based Access Control (RBAC)

The skeleton implements a sophisticated RBAC system:

**Structure**:
```
Admin User
    └── belongs to → Admin Groups
                         └── have → Module Access (Module Rules)
                                        └── define → Permissions
```

**How It Works**:
1. Create modules representing your features (e.g., "FAQ Management")
2. Define module rules for granular permissions (e.g., "View List", "Edit")
3. Create admin groups and assign module rules
4. Add admins to groups
5. Annotate controllers with `@RequireModule()` / `@RequireRule()`

**What the guard attaches** (`AdminAuthGuard`, permissions cached in Redis):
```typescript
request.user = {
  id: '...',
  fullname: '...',
  sessionId: '...',            // the session this access token belongs to
  adminGroupDetail: {
    groups: [{ id: '...', name: 'Admin' }],
    modules: [
      { name: 'FAQ Management', rules: [{ name: 'View List' }, { name: 'Edit' }] }
    ]
  }
}
```

### File Upload & Storage

Uploads go through `StorageService`, which works the same for every module and
every provider (`DISK_STORAGE=local | s3 | obs`). Everything about uploads —
folders, accepted file types, size limits — is defined once in
`src/common/config/upload.config.ts`.

**Adding uploads to a new module** (e.g. product images):

1. **Register the folder** in `UPLOAD_FOLDERS` (`upload.config.ts`):
   ```typescript
   export const UPLOAD_FOLDERS = ['avatar-admin', 'avatar-user', 'banner', 'product-image'] as const;
   ```
   `UploadFolder` is typed from this list, so an unregistered folder doesn't
   compile — and `deleteFile()` only ever deletes files in these folders.
2. **Pre-check in the controller** with the shared multer settings (what the
   client *claims* — cheap, early 422):
   ```typescript
   @UseInterceptors(
     FileInterceptor('image', {
       limits: { fileSize: defaultMaxFileSize },              // UPLOAD_SIZE_LIMITS.image
       fileFilter: (req, file, cb) =>
         file.mimetype.match(defaultAllowedImageTypeRegex)    // from FILE_TYPES
           ? cb(null, true)
           : cb(invalidMimesType(defaultAllowedImageTypes, ['image']), false),
     }),
   )
   ```
3. **Store it** — the content is checked here, by its bytes:
   ```typescript
   const stored = await this.storageService.uploadFile(file, {
     folder: 'product-image',
     prefix: 'product',
     identifier: product.name,
     accept: ['image'],          // or ['image', 'video']; default ['image']
   });
   ```
   Files whose content isn't an accepted type are rejected with 422
   `UNSUPPORTED_FILE_CONTENT` — a renamed HTML page sent as `image/png` never
   gets stored. The stored name and Content-Type come from the detected type.
   Stored names always end in a timestamp and a random part
   (`product-shoe-1760000000000-9f2c1a3b.png`), so uploads with the same
   `customName`/`identifier` never overwrite each other.
4. **Replacing a file** — use `withUpload`: it uploads first, runs your save,
   deletes the old file only after the save succeeds, and removes the new
   upload if the save fails (no broken references, no orphans):
   ```typescript
   const product = await this.storageService.withUpload(
     { file: image, options: { folder: 'product-image', prefix: 'product' }, replaces: product.imageUrl },
     (imageUrl) => this.prisma.product.update({ where: { id }, data: { imageUrl: imageUrl ?? undefined } }),
   );
   ```
5. **Accepting a file reference from a client** (a URL in a JSON body or an
   imported row) — validate it, because it may later be passed to
   `deleteFile()`:
   ```typescript
   // DTO
   @IsFileReference('product-image')
   imageUrl: string;

   // service code (e.g. import rows)
   if (!isFileReference(row.imageUrl, 'product-image')) { /* FILE_REFERENCE_INVALID */ }
   ```
   A file reference is an `http(s)` URL or a stored upload path in that folder;
   `javascript:`, `data:` and paths like `../../.env` are rejected.

**Accepting a new file type** (e.g. PDF): add an entry to `FILE_TYPES` with
its magic bytes (and a new `FileKind` + `UPLOAD_SIZE_LIMITS` entry if it's a
new kind). Detection, the multer pre-check regexes and `/response` all read
that table.

**Serving local files**: `GET /response/<path with / as $>` serves only files
under `src/public/uploads`, with `X-Content-Type-Options: nosniff`; anything
that isn't an image or video is sent as a download.

**Supported providers**:
- `local` - Stores in `src/public/uploads/`
- `s3` - AWS S3 with bucket configuration
- `obs` - Huawei Object Storage Service (stored URLs use `OBS_DOMAIN_NAME`,
  which may be a custom CDN domain — deletes work with it as well as with the
  bucket's `*.myhuaweicloud.com` URLs)

### Logging System

**Activity Logging**:
```typescript
// In your service
await this.helper.logAction(LogActions.ADD_NEW, {
  adminId: req.user.id,
  request: req,
  moduleName: 'Admin Management',
  targetId: newAdmin.id,
  notes: 'Created new admin user',
  valueBefore: null,
  valueAfter: newAdmin,
});
```

**Error Logging**:
Any 5xx or unexpected error thrown from a handler is written to `error_logs`
by `GlobalExceptionFilter`, tagged with the controller's `@RequireModule`,
the route's `:id` and the signed-in admin. To log manually, inject
`ErrorLogService`:
```typescript
await this.errorLog.logFromRequest(req, error, { remarks: 'Additional context' });
```

### Email System

Inject `MailRelayService` (from `MailRelayModule`) to send through Marley,
or `MailService` (from `MailModule`) to send over SMTP. Both have the same
methods, so switching is a change of injection.

**Using templates**:

1. Create template in `mails/` directory:
```handlebars
<!-- mails/welcome.hbs -->
<h1>Welcome {{fullname}}!</h1>
<p>Your account has been created.</p>
```

2. Send email:
```typescript
await this.mailService.sendMailWithTemplate(
  user.email,
  'Welcome to Our Platform',
  'welcome',
  { fullname: user.fullname }
);
```

**Built-in templates** (both senders have a method for each):

| Template | Method | Context |
|---|---|---|
| `forgot-password.hbs` | `sendForgotPasswordOtp` | `fullname`, `otp`, `expireMinutes` |
| `register-otp.hbs` | `sendRegisterOtp` | `fullname`, `otp`, `expireMinutes` |
| `reset-password-link.hbs` | `sendResetPasswordLink` | `fullname`, `resetLink`, `expireMinutes` |

Templates compile in strict mode, so a missing variable throws instead of
rendering blank.

Example (forgot-password.hbs):
```typescript
// The skeleton includes a pre-built OTP email template
await this.mailService.sendForgotPasswordOtp({
  to: admin.email,
  otp: '123456',
  fullname: admin.fullname,
  expireMinutes: '5'
});
```

### Password Reset Flow (OTP-based)

The skeleton includes a secure 3-step password reset process:

**Step 1: Request OTP**
```typescript
// POST /auth/forgot-password
{
  "email": "admin@example.com"
}
// Sends an OTP (OTP_LENGTH digits, default 6) to email, valid for 5 minutes (configurable)
```

**Step 2: Verify OTP**
```typescript
// POST /auth/verify-otp
{
  "email": "admin@example.com",
  "otp": "123456"
}
// Returns a reset token valid for 15 minutes: data = { "token": "abc123..." }
// Each OTP allows OTP_MAX_ATTEMPTS wrong guesses, then a new one must be requested
```

**Step 3: Reset Password**
```typescript
// POST /auth/reset-password
{
  "token": "abc123...",
  "password": "NewPassword123!"
}
// Resets the password, invalidates the token and signs out every session
```

**Security Features**:
- OTP length is configurable (`OTP_LENGTH`, default 6) and generated with a CSPRNG
- OTPs, reset tokens and refresh tokens are stored only as SHA-256 hashes
- Each OTP is invalidated after `OTP_MAX_ATTEMPTS` wrong guesses; requesting a new one retires the old
- OTP expires after configured time (default: 5 minutes)
- Rate limiting on OTP resend (default: 60 seconds)
- Resetting or changing a password signs out other sessions
- Reset token expires after 15 minutes
- Password validation (min 8 chars, uppercase, lowercase, number, special char)
- Email enumeration protection
- One-time use tokens

### Maintenance Mode

Mark **user-facing** controllers or routes with `@UnderMaintenance()`; admin
routes are never marked, so admins can always switch maintenance off again.

```typescript
import { UnderMaintenance } from 'src/common/maintenance';

@Controller('app')
@UnderMaintenance()          // or on individual routes
export class AppHomeController { … }
```

Clients say which platform they are with a header, and two global config
flags (`/admin/global-config`) decide who gets a **503** (standard error
envelope, message `APP_UNDER_MAINTENANCE`):

| `X-Client-Platform` | Blocked when |
|---|---|
| `mobile` | `IS_MOBILE_MAINTENANCE` is `true` |
| `web` | `IS_WEBSITE_MAINTENANCE` is `true` |
| missing / anything else | **both** flags are `true` |

Flag values are on only for `true` (any case), like the env on/off settings.
Values are cached for 60 s and the cache is dropped whenever a flag is
created, updated or deleted, so switching takes effect immediately.
`X-Client-Platform` is allowed by CORS. Frontends and mobile apps should send
it on every request.

### Reusable Validation & Import Helpers

Shared building blocks in `src/common/helpers` — use these in new modules
instead of re-implementing them:

| Helper | Use |
|---|---|
| `@IsSafeLink()` / `isSafeLink()` | Links users get sent to: http(s) URLs or app paths (`/x`); blocks `javascript:`, `data:`, `//host` |
| `@IsFileReference(folder)` / `isFileReference()` | A file field: http(s) URL or a stored upload in that folder (see uploads) |
| `@NormalizeEmail()` + `assertEmailAvailable(table, email, id?)` | Emails are trimmed + lowercased; 409 `EMAIL_ALREADY_EXISTS` if taken (emails are unique per table, case-insensitive) |
| `readSpreadsheet(buffer, 'xlsx' \| 'csv', { maxRows })` | Spreadsheet imports: rows of plain text (hyperlink/formula/boolean cells unwrapped), header aliases via `pickColumn`, yes/no via `parseBooleanCell`, 400 on unparseable files or too many rows |

Validation messages fill `$constraint1`, `$constraint2`, … from the
decorator's own arguments (`@MaxLength(255)` → "must not exceed 255
characters"), so any class-validator decorator works with translated messages.

### List Endpoints, Concurrency & Database Errors

Building blocks for list endpoints and safe writes (`src/common/http`,
`src/common/helpers/db-lock.helper.ts`, `src/filters/prisma-error.mapper.ts`):

| Helper | Use |
|---|---|
| `toDatatable({ page, limit, sort, sortDirection, q }, { sortable, defaultSort?, defaultDirection?, filter? })` | Raw list query params → a safe `DatatableType`. Bad values are **silently fixed up**: `page` → 1, `limit` capped at 100 (default 10), a `sort` column not in `sortable` → the default (so `sort=password` never reaches Prisma), repeated params → first value |
| `queryString(q)` / `queryFlag(value)` | Single query params: trimmed text or `null`; `"true"`/`"false"` (any case) → boolean, anything else → `undefined` (= don't filter) |
| `lockScope(tx, orderingScope('product', parentId))` | Inside `$transaction`: serialises writes that read-then-write ordering (or any other "max + 1") so concurrent requests can't get the same position |
| `mapPrismaError()` (automatic) | `GlobalExceptionFilter` turns database errors a client caused into 4xx instead of 500: unique violation → 409 `DUPLICATE_ENTRY`, record not found → 404 `RECORD_NOT_FOUND`, value too long → 422, broken reference → 409, malformed value → 400 |

```typescript
// controller
const PRODUCT_SORTABLE = ['name', 'price', 'createdAt'] as const;

@Get()
findAll(@Query('page') page?: string, @Query('limit') limit?: string,
        @Query('sort') sort?: string, @Query('sortDirection') sortDirection?: string,
        @Query('q') q?: string) {
  return this.productService.findAll(
    toDatatable({ page, limit, sort, sortDirection, q }, { sortable: PRODUCT_SORTABLE }),
  );
}

// service — new item goes to the end of its list
await this.prisma.$transaction(async (tx) => {
  await lockScope(tx, orderingScope('product'));
  const { _max } = await tx.product.aggregate({ where: { deletedAt: null }, _max: { ordinal: true } });
  return tx.product.create({ data: { ...dto, ordinal: (_max.ordinal ?? 0) + 1 } });
});
```

Soft-deleted rows count as not found for update/delete (restore them first).

### Response Formatting

Handlers return plain data; `ResponseInterceptor` wraps it in the standard
envelope and `GlobalExceptionFilter` formats anything thrown.

**Success Response** — `{ code, status: 'success', message, data }`:
```typescript
@Post()
@HttpCode(HttpStatus.CREATED)               // envelope `code` follows the HTTP status
@ResponseMessage('DATA_CREATED_SUCCESS')    // key from success-messages.ts
async create(@Body() dto: CreateProductDto) {
  return this.productService.create(dto);
}
```

**Error Response** — `{ code, status: 'errors', message, data: null }`:
```typescript
throw new BadRequestException(
  ErrorMessageHelper.getMultiLanguageMessage('PRODUCT_NOT_FOUND'),
);
```

**Paginated Response** — adds `pagination` next to `data`:
```typescript
import { Paginated } from 'src/common/http/paginated';

return new Paginated(
  { totalCount, currentPage, lowestNumber, highestNumber },
  data,
);
```

Handlers that stream files keep `@Res()` and write the response themselves.

---

## 📖 Usage Examples

### Creating a New Module

1. **Generate the module**:
```bash
nest g module core/product
nest g controller core/product
nest g service core/product
```

2. **Create the model** (`src/models/Product.model.ts`) and register it in
   `MODELS` in `src/models/models.module.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductModel {
  constructor(private readonly prisma: PrismaService) {}

  findAll = async () => this.prisma.product.findMany();

  findOne = async (id: string) =>
    this.prisma.product.findUnique({ where: { id } });

  create = async (data: CreateProductDto) =>
    this.prisma.product.create({ data });
}
```

3. **Create DTOs** (`src/core/product/dto/create-product.dto.ts`):
```typescript
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;
}
```

4. **Implement service** (`src/core/product/product.service.ts`):
```typescript
import { Injectable } from '@nestjs/common';
import { ProductModel } from 'src/models';

@Injectable()
export class ProductService {
  constructor(private readonly productModel: ProductModel) {}

  findAll() {
    return this.productModel.findAll();
  }

  create(data: CreateProductDto) {
    return this.productModel.create(data);
  }
}
```

   Because Prisma comes in through DI, the service is unit-testable with a
   mocked `ProductModel` / `PrismaService` — see `auth.service.spec.ts`.

5. **Implement controller** (`src/core/product/product.controller.ts`):
```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import { RequireModule, RequireRule } from 'src/common/decorators/permission.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { ProductService } from './product.service';

@Controller('product')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Product Management')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequireRule('View List')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  findAll() {
    return this.productService.findAll();
  }

  @Post()
  @RequireRule('Add New')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('DATA_CREATED_SUCCESS')
  create(@Body() data: CreateProductDto) {
    return this.productService.create(data);
  }
}
```

6. **Add to AppModule** (`src/app.module.ts`):
```typescript
import { ProductModule } from './core/product/product.module';

@Module({
  imports: [
    // ... other modules
    ProductModule,
  ],
})
export class AppModule {}
```

### Protecting Routes with Authentication

```typescript
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';

@Controller('report')
@UseGuards(AdminAuthGuard)  // All routes require a signed-in admin
export class ReportController {
  // Routes here are protected
}
```

Use `UserAuthGuard` the same way for end-user routes. Validate `:id` params
with `@Param('id', UuidPipe) id: string` so malformed ids return a 422.

### Checking Permissions

Put `@RequireModule()` on the controller and `@RequireRule()` on the route;
`PermissionsGuard` answers 403 when the admin's groups lack that rule
(`*root` passes everything). Permissions are cached in Redis and refreshed
automatically when groups, modules or rules change.

```typescript
@Get(':id')
@RequireRule('View Details')
findOne(@Param('id', UuidPipe) id: string) {
  return this.userService.findOne(id);
}
```

---

## 👨‍💻 Development Guide

### Working with Claude Code

The repo ships a shared Claude Code setup in `.claude/` (committed — keep
personal settings in `.claude/settings.local.json`, which is git-ignored):

| File | Purpose |
|---|---|
| `.claude/CLAUDE.md` | Project instructions loaded every session: commands, architecture, conventions, git rules, how to answer |
| `.claude/skills/new-module` | `/new-module` — scaffold an admin CRUD module the skeleton's way (schema, model, DTOs, RBAC seed, tests, README) |
| `.claude/skills/add-upload` | `/add-upload` — add file uploads with the shared storage registry |
| `.claude/skills/review-module` | `/review-module` — review code against the security / data / robustness checklist |
| `.claude/settings.json` | Shared permissions: lint/test/type-check run without prompts; `.env` reads and DB resets are denied |

Claude also picks the skills up on its own when a request matches. When you
change a convention, update `.claude/CLAUDE.md` (and the skill that covers it)
in the same PR.

### Code Style

- Follow NestJS conventions and best practices
- Use TypeScript strict mode
- Use dependency injection
- Keep controllers thin, services fat
- Use DTOs for all inputs and outputs
- Use Prisma through injected model classes (`src/models`) or `PrismaService`

### Adding Environment Variables

1. Add it to `AppConfig` in `src/common/config/env.validation.ts` with its
   type, validation and default (see the `int` / `flag` / `str` transforms —
   empty values fall back to the default)
2. Add it to `.env.example`
3. Read it through the typed `ConfigService` — no casts, no `process.env`:

```typescript
import { ConfigService } from '@nestjs/config';
import { AppConfig } from 'src/common/config/env.validation';

constructor(private readonly config: ConfigService<AppConfig, true>) {}

const minutes = this.config.get('OTP_EXPIRE_MINUTES'); // number, validated
```

In unit tests, pass `testConfig({ MY_VAR: 'value' })` from
`src/common/config/config.testing.ts` — it builds a real, validated config.

`process.env` is only read where DI isn't available — class-validator
decorators (`getOtpLength()`), static helpers, `prisma.config.ts` and seeds —
and module-level switches (e.g. `EXECUTE_CRON`) use `ConditionalModule` so they
are evaluated after `.env` is loaded.

### Database Changes

1. Update `prisma/schema.prisma`
2. Create migration:
```bash
npx prisma migrate dev --name description_of_change
```
3. Update the model class in `src/models/`
4. Update seed data if needed
5. Keep migrations backward-compatible: during a blue/green deploy the old
   release briefly runs against the new schema

### Adding New Seed Data

1. Create seed file in `prisma/seed/your-model.seed.ts`
2. Add to `prisma/seed.ts` (seeds receive the Prisma client):
```typescript
import { yourModelSeed } from './seed/your-model.seed';

async function main() {
  // ... other seeds
  await yourModelSeed(prisma);
}
```

---

## 🧪 Testing

### Run Unit Tests
```bash
npm run test       # all *.spec.ts under src/
npm run test:cov   # with coverage
```

### Run E2E Tests
```bash
npm run test:e2e
```
The e2e suite boots the real `AppModule` (with `configureApp()`, as `main.ts`
does) and covers health, sessions and token rotation, the OTP reset flow,
RBAC and cache invalidation, UUID validation and rate limiting, upload and
link security (`security`), data correctness — imports, ordering, FAQ cascade,
emails (`data`) — and robustness — list param fix-ups, races, soft-deleted
rows, FAQ tree moves (`robustness`).

- **Database:** `E2E_DATABASE_URL`, default
  `postgresql://postgres:postgres@localhost:5432/app_e2e_test`. It is **reset**
  (`prisma migrate reset`), migrated and seeded on every run, and created if
  missing. It never uses `DATABASE_URL` from `.env`, and refuses any database
  whose name doesn't contain `test`.
- **Redis:** not used — the suite runs on the in-memory store.
- **Email:** `MailService` is replaced by a fake that records OTPs.
- **CI:** the *E2E tests* job runs it against a disposable Postgres container,
  in parallel with lint/test/build.

> Prisma refuses `migrate reset` when it detects an AI coding agent, so run the
> e2e suite yourself (or in CI) rather than through an agent.

### Writing Tests

Services get Prisma through DI, so unit tests construct them with mocks — no
database needed. `src/core/admin/auth/auth.service.spec.ts` is the reference:

```typescript
// faq.service.spec.ts
import { FAQService } from './faq.service';

describe('FAQService', () => {
  const helper = { logAction: jest.fn() } as any;
  const prisma = {} as any;
  const faqModel = { findAll: jest.fn().mockResolvedValue([]) } as any;
  const service = new FAQService(helper, prisma, faqModel);

  it('lists FAQs through the model', async () => {
    await expect(service.findAll({ search: null })).resolves.toEqual([]);
    expect(faqModel.findAll).toHaveBeenCalled();
  });
});
```
Check the service's constructor for the argument order. Jest maps the `src/…`
and `@prisma` import aliases, so specs import modules exactly like the app does.

---

## 🚀 Deployment

### Production Checklist

- [ ] Change the seeded admin credentials
- [ ] Set a random `JWT_SECRET_KEY` (32+ chars) and other secrets on the server
- [ ] Set `APP_ENV=production` (hides API docs)
- [ ] Set `TRUST_PROXY` to the number of proxies in front of the app (1 behind nginx)
- [ ] Configure `ALLOWED_ORIGINS` for your web clients
- [ ] Provide Redis (`REDIS_*`) if you run more than one instance
- [ ] Configure SMTP and file storage (S3/OBS recommended for production)
- [ ] Enable HTTPS at the proxy
- [ ] Enable automated database backups (migrations have no down step)
- [ ] If you deploy with Docker: set `DOCKER_ENABLED`, `SWR_ORG`, `IMAGE_NAME`, `DEPLOY_DIR` in `.github/ci.env`, add the deploy secrets, and follow [`deploy/README.md`](deploy/README.md)

> **Step-by-step runbook:** [`deploy/README.md`](deploy/README.md) — server
> setup (nginx, sudo, Redis, SWR login, `api.env`), repository settings and
> secrets, first deploy, rollback, migrations and troubleshooting.

### CI/CD Docker Toggle

Docker work in GitHub Actions is **off by default** to save CI time. Turn it
on, and set the deployment target, in the code in `.github/ci.env`:

```env
DOCKER_ENABLED=true
# SWR organization the image is pushed to (deploys refuse the placeholder)
SWR_ORG=your-swr-organization
IMAGE_NAME=nest-api
# directory on the server
DEPLOY_DIR=/opt/app/api
```

| `DOCKER_ENABLED` | PRs into `main` | Push to `main` |
|---|---|---|
| `false` / unset (default) | Lint, test, build | Lint, test, build — no image, no deploy |
| `true` | + Docker build check | + build & push image to SWR, deploy to the server |

Each value is resolved by `.github/workflows/ci-config.yaml` in this order:
repository variable of the same name (optional override, GitHub → Settings →
Secrets and variables → Actions → Variables) → `.github/ci.env` → default.
Invalid values (uppercase org, relative path, …) fail CI with a clear error.
Only the value `true` (any case) turns it on; a missing file or line means off.
`.env` is not used here — it is git-ignored, so the runners never see it.

A manual **Run workflow** on *Deploy* always builds and deploys (or rolls back
to the given image tag), whatever the flag says.

### Docker Image

`Dockerfile` builds a production image in four stages: install deps → build
(`prisma generate` + `nest build`) → production deps (+ prisma CLI and tsx for
migrations/seeding) → runtime.

- `node:24-alpine`, runs as the non-root `nestjs` user
- `tini` as PID 1 for signal handling
- `HEALTHCHECK` on `/healthz/ready` (database + Redis)
- `CMD node dist/src/main.js` — migrations are **not** run on startup; the
  deploy script runs them (see below)
- Listens on `APP_PORT` (4000 in the image)

```bash
docker build -t nest-api:local .
docker run --rm -p 4000:4000 --env-file .env nest-api:local
```
`.dockerignore` keeps `.env` / `.env.*` out of the build context, so local
secrets never end up in any image layer or build cache. Runtime configuration
comes from `--env-file` locally and from `api.env` on the server.

### CI/CD Pipeline (GitHub Actions)

- **`ci.yaml`** — on PRs into `main` and pushes to other branches: lint, unit
  tests, build, advisory `npm audit`; plus the Docker build check when
  `DOCKER_ENABLED` is on.
- **`deploy.yaml`** — on push to `main`: runs CI, then (only when
  `DOCKER_ENABLED` is on) builds and pushes the image to Huawei SWR tagged with
  the short commit SHA, and deploys it.
- **`ci-config.yaml`** — resolves the settings in `.github/ci.env` for the other two.

**Deploy secrets** (Settings → Secrets and variables → Actions):
`SWR_REGISTRY`, `SWR_USERNAME`, `SWR_PASSWORD`, `SERVER_HOST`,
`SERVER_USERNAME`, `SERVER_SSH_KEY`, `SERVER_PORT`.

### Blue/Green Deployment

The deploy job copies `deploy/docker-compose.prod.yml` and `deploy/deploy.sh`
to `DEPLOY_DIR` on the server and runs `./deploy.sh <tag>` (passing the
registry, organization and image name, which the script saves to `.env`):

1. Pull the new image into the idle color (`api-blue` on 127.0.0.1:4001 or `api-green` on :4002)
2. Run `prisma migrate deploy`
3. Start the idle color and wait for `/healthz/ready`
4. Switch the nginx upstream to it, then stop the old color

Live traffic is untouched until the switch; a failed deploy just stops the idle
color. Uploads persist in the `uploads` volume.

**Server files** (next to the compose file, not in git):
- `.env` — compose variables managed by `deploy.sh` (`SWR_REGISTRY`, `SWR_ORG`, `IMAGE_NAME`, `BLUE_TAG`, `GREEN_TAG`, `ACTIVE_COLOR`)
- `api.env` — the application environment (`DATABASE_URL`, `JWT_SECRET_KEY`, …), `chmod 600`

**Rollback**: run the *Deploy* workflow manually with the previous image tag
(details and an instant manual rollback in [`deploy/README.md`](deploy/README.md#6-rollback)).

---

## 💎 Best Practices

### Security
- Always validate user input with DTOs
- Use `AdminAuthGuard` + `PermissionsGuard` for protected routes
- Validate `:id` params with `UuidPipe`
- Never commit `.env` files
- Regularly update dependencies
- Use HTTPS in production
- Add `@RateLimit()` to sensitive endpoints
- Sanitize file names before uploading

### Database
- Use Prisma migrations for all schema changes
- Never modify migration files after they're committed
- Use transactions for multiple related operations
- Index frequently queried fields
- Use soft deletes (deletedAt) instead of hard deletes
- Keep migrations backward-compatible with the previous release (blue/green)

### Code Organization
- One feature per module
- Keep services focused on business logic
- Use DTOs for all controller inputs
- Inject model classes / `PrismaService` instead of importing a global client
- Create reusable utilities in `src/utils/`
- Use constants for repeated strings

### Error Handling
- Use NestJS built-in exceptions
- Throw exceptions; `GlobalExceptionFilter` formats them
- Log server errors (500+) automatically
- Provide meaningful error messages
- Don't expose sensitive information in errors

### Performance
- Use pagination for list endpoints
- Cache hot lookups in Redis (see `AdminAccessService`)
- Optimize database queries (use `select` to limit fields)
- Use async/await consistently
- Avoid N+1 query problems

### Git Workflow
```bash
# Feature branch
git checkout -b feature/new-feature
# Commit changes
git commit -m "feat: add new feature"
# Push and create PR
git push origin feature/new-feature
```

---

## 📄 License

This project is licensed under the UNLICENSED license. You are free to use, modify, and distribute this skeleton for your projects.

---

## 🤝 Contributing

This is a starter skeleton meant to be customized for your specific needs. Feel free to:

- Add new modules
- Remove unused modules
- Customize validation messages
- Add your own utilities
- Extend the authentication system
- Improve documentation

---

## 📞 Support

For issues, questions, or contributions, please refer to your team's internal documentation or contact the maintainer.

---

## 🎓 Learning Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Happy Coding! 🚀**
