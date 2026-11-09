---
name: review-module
description: Review a module, branch or diff in this skeleton against the security, data-correctness and robustness checklist learned from past reviews. Use when asked to review code, a PR, a module, or "check for issues" here.
---

# Review against the skeleton checklist

These are the issue classes found (and fixed) in this codebase before. New
code tends to reintroduce them, so check each one that applies. Read the
code; don't report a finding you haven't confirmed in the source.

## Security
- [ ] Every admin route has `AdminAuthGuard` + `PermissionsGuard`, a
      `@RequireModule` on the class and a `@RequireRule` per route; the
      module/rule names exist in `prisma/seed/module*.seed.ts`.
- [ ] Non-root admins can't grant rules they don't hold or act on root admins
      (`assertCanGrantRules`, see `src/common/auth/rbac.helpers.ts`).
- [ ] `:id` / id query params use `UuidPipe`; id body fields `@IsUUID`.
- [ ] Uploads go through `StorageService.uploadFile` (content check by magic
      bytes), folder registered in `upload.config.ts`; no `AnyFilesInterceptor`.
- [ ] Client-supplied URLs/paths: `@IsFileReference(folder)` before they can
      reach `deleteFile()`; links users are redirected to: `@IsSafeLink()`
      (blocks `javascript:`, `data:`, `//host`).
- [ ] No secrets, stack traces or internal errors in responses or logs.
- [ ] Sort/filter columns come from an allow-list (`toDatatable` `sortable`),
      never straight from the query string into Prisma.

## Data correctness
- [ ] Spreadsheet imports use `readSpreadsheet`/`pickColumn`/`parseBooleanCell`,
      validate every row first and insert all-or-nothing in one transaction,
      with a row limit; errors name the row and field.
- [ ] Yes/no values: unknown values are an error, not silently `true`/`false`
      (`value || true` turns FALSE into true).
- [ ] Emails `@NormalizeEmail()` + `assertEmailAvailable()` (case-insensitive unique).
- [ ] Replacing files uses `withUpload` (old file deleted only after the save).
- [ ] Ordering: position 1 = top; deleted rows excluded from counts/positions;
      exports in the same order as the list.
- [ ] Soft delete: deleting a parent handles children (cascade or block);
      restore can't resurrect a child of a deleted parent.

## Robustness
- [ ] List endpoints use `toDatatable` (page ≥ 1, limit ≤ 100, safe sort);
      flags via `queryFlag` (`"true"`/`"false"` only), text via `queryString`.
- [ ] Read-then-write of ordinals/counters under
      `lockScope(tx, orderingScope(...))` inside `$transaction`.
- [ ] Update/delete of a soft-deleted row → NOT_FOUND; referenced rows
      (groups, parents) must be live (`deletedAt: null`, active where relevant).
- [ ] Partial updates: an omitted optional field keeps its value (e.g. a group
      update without `moduleRuleIds` must not wipe rules); every DTO field the
      client can send is actually written.
- [ ] Tree data: no moving a node under itself or a descendant; level/ordinal
      recomputed on move.
- [ ] Upserts instead of create where a unique pair may already exist.
- [ ] Errors use `ErrorMessageHelper` keys with `en` + `id` text; status codes
      match the rest of the API (403 permission, 422 validation, 409 conflict).

## Template hygiene
- [ ] Generic: no project/client names; reusable logic lives in `src/common`.
- [ ] New env vars in `env.validation.ts` and `.env.example`.
- [ ] Tests: unit specs for logic, e2e for client-visible behaviour.
- [ ] README updated for anything documented there.

## Output

Report findings as a table ordered by severity — **#, severity
(critical/high/medium/low), file:line, problem, concrete failure scenario,
suggested fix** — followed by "Client impact" for anything that changes API
behaviour. Say which checklist areas you checked and found clean. Don't fix
anything until the developer picks which findings to address.
