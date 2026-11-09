# NestJS API Skeleton — guide for Claude

This repo is a **skeleton / template**: every project starts by copying it, so
code here must be generic and reusable. When something one module needs is
useful to others, build the shared piece (in `src/common`) and make the module
its first user. Never name things after a specific project or client.

`README.md` is the full reference (features, env vars, recipes). Read the
relevant section before changing a feature, and keep it up to date in the same
change.

## Commands

```bash
npm run start:dev                 # dev server (Swagger at /docs)
npm run lint                      # eslint --fix
npx tsc --noEmit -p tsconfig.json # type-check
npm test                          # unit tests (src/**/*.spec.ts, no DB needed)
npm run test:e2e                  # e2e — RESETS the test DB, see below
npx prisma generate               # after editing prisma/schema.prisma
npx prisma migrate dev --name <x> # create a migration (dev DB only)
npx tsx prisma/seed.ts            # seed modules, rules, root admin
```

Run Jest through the npm scripts. Nest 12 packages are ESM-only and Jest needs
`node --experimental-vm-modules` to load them; plain `npx jest` fails with
"Must use import to load ES Module".

Before calling work done: type-check, lint, and unit tests must pass. Say what
you ran and the result; if you couldn't run something, say so.

**E2E tests:** `npm run test:e2e` runs `prisma migrate reset` on
`E2E_DATABASE_URL` (default `app_e2e_test`; it refuses any DB without "test" in
its name). Prisma blocks that reset when an AI agent runs it, so don't try to
bypass it. Ask the developer to run `! npm run test:e2e`, or rely on the CI
"E2E tests" job. Never point it at a real database.

## Architecture

| Path | What lives there |
|---|---|
| `src/core/admin/<module>/` | Feature modules: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, `entities/` (Swagger response shapes) |
| `src/models/` | Query classes over Prisma (`BannerModel`, …), registered in `MODELS` in `models.module.ts` (global — inject anywhere) |
| `src/common/` | Shared building blocks — **check here before writing anything generic** |
| `src/common/constants/` | `error-messages.ts`, `success-messages.ts`, `validation-messages.ts`, `field-names.ts`, `log-actions.ts` |
| `src/common/config/` | `env.validation.ts` (typed env, `ConfigService<AppConfig, true>`), `upload.config.ts` |
| `src/guards`, `src/pipes`, `src/filters` | Auth/RBAC/rate-limit guards, `UuidPipe`, global exception filter + Prisma error mapping |
| `prisma/` | `schema.prisma` (client generated to `src/generated/prisma`, import from `@prisma`), migrations, `seed/` |
| `test/` | e2e suites + `helpers.ts` (`createTestApp`, `login`, `bearer`, `waitForOtp`) |

## Conventions (follow these — reviewers will check)

**Controllers**
- Admin endpoints: `@UseGuards(AdminAuthGuard, PermissionsGuard)` +
  `@RequireModule('<Name> Management')` on the class, `@RequireRule('View List' | 'View Details' | 'Add New' | 'Edit' | 'Delete' | 'Restore' | 'Sorting')` per route.
  The module and its rules must exist in `prisma/seed/module.seed.ts` and
  `module-rule.seed.ts`, or nobody but `*root` can call them.
- Return plain data; `ResponseInterceptor` builds the envelope. Use
  `@ResponseMessage('<KEY>')` and `@HttpCode(...)`. Lists return
  `new Paginated(pagination, data)`.
- `:id` params use `UuidPipe`. List params go through
  `toDatatable({ page, limit, sort, sortDirection, q }, { sortable: X_SORTABLE })`;
  single query params through `queryString()` / `queryFlag()` (`src/common/http/datatable.ts`).
- Swagger on every route: `@ApiOperation`, `@ApiSuccessResponse(Entity)` /
  `@ApiSuccessPaginationResponse` / `@ApiSuccessNoDataResponse`,
  `@ApiCommonErrorResponses()` (`src/common/swagger/response.schemas.ts`).
- Validation is global (`TranslatedValidationPipe`: whitelist, forbid unknown
  fields, 422 with translated messages). Don't add `@UsePipes(new ValidationPipe())`
  in new code.

**Services**
- Throw Nest exceptions with translated messages, never raw strings:
  `ErrorMessageHelper.getMultiLanguageMessage('KEY')` (or `…WithReplace('KEY', { field })`).
  Every new key goes in `error-messages.ts` with **both `en` and `id`** text.
- Soft delete: rows have `deletedAt`. Lists hide deleted rows unless asked;
  update/delete of a deleted row is NOT_FOUND; restore is `PUT /:id/restore`.
- Audit: call `this.helper.logAction(LogActions.X, { adminId, request, moduleName, targetId, valueBefore?, valueAfter? })`
  for view/create/update/delete/restore.
- Multi-step writes go in `this.prisma.$transaction(async (tx) => …)`.
  Anything that reads then writes an ordinal/counter takes
  `lockScope(tx, orderingScope('<entity>', parentId))` first.
- Unique/foreign-key/not-found DB errors are mapped to 409/404/422/400 by the
  global filter — no need to catch them, but do pre-check where a friendlier
  message helps.

**Shared helpers — use, don't re-implement**
- Uploads: `StorageService.uploadFile(file, { folder, accept })`, `withUpload(...)`
  for replacing files; folders/types/limits in `src/common/config/upload.config.ts`
  (use the `add-upload` skill).
- Client-supplied file URLs: `@IsFileReference(folder)`. Links users are sent to:
  `@IsSafeLink()`. Emails: `@NormalizeEmail()` + `assertEmailAvailable()`.
- Spreadsheet import: `readSpreadsheet`, `pickColumn`, `parseBooleanCell`.
- Boolean DTO fields: `@Transform(toBoolean)` + `@IsBoolean()` (`transform.helper.ts`),
  never `value === 'true' || value === true` — that turns bad input into `false`.
- `from`/`to` date query params: `parseDateQuery(value, 'from' | 'to', APP_TIMEZONE)`
  (`date-query.helper.ts`) — a bare date is the whole day in that timezone.
- Email: `MailRelayService` (import `MailRelayModule`) sends through Marley, the
  office HTTP mail relay, and logs each call to `mail_relay_logs`. `MailService`
  (SMTP) has the same methods. `MAIL_SERVICE_ENABLED=false` turns the relay
  off: no Marley settings needed, sends are skipped. Templates live in `mails/*.hbs`; built-ins are
  forgot-password, register-otp and reset-password-link.
- Today's date for `@db.Date` columns: `todayAsDbDate(APP_TIMEZONE)`
  (`db-date.helper.ts`), never `setHours(0, 0, 0, 0)`.
- Config: `ConfigService<AppConfig, true>`; add new env vars to
  `env.validation.ts` **and** `.env.example`. On/off flags are on only for
  `"true"` (any case); comments in env files go on their own line.

**Tests**
- Unit tests next to the code (`*.spec.ts`), services built with mocks (see
  `src/core/admin/auth/auth.service.spec.ts`; `testConfig()` for config).
- Behaviour a client can see gets an e2e test in `test/*.e2e-spec.ts`.

## Git

- Branch from `main`, conventional commits (`feat(scope):`, `fix(scope):`,
  `docs:` …), one concern per commit, each commit builds and passes tests.
- Open a PR to `main`; merge only when the developer says so, with a merge
  commit. Update `README.md` before merging changes it documents.
- Never delete the `ecs-swr-github-action-example` branch.
- Never delete the `release/nest-11` branch or the `v1.0.0` tag: they are the
  NestJS 11 checkpoint. Fixes for Nest 11 projects go to `release/nest-11`.

## How to answer in this repo

- Cite code as `path:line`. Base answers on the code, not on assumptions about
  "typical NestJS" — this skeleton has its own helpers and rules above.
- When a change affects API clients (status codes, response fields, required
  headers, validation), call it out explicitly under a "Client impact" note.
- If a request would add module-specific code where a shared helper fits,
  say so and propose the generic version.
- Never read or print real secrets (`.env`); use `.env.example` for the list of settings.
