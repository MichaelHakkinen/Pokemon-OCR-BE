---
name: new-module
description: Scaffold a new admin CRUD module (Prisma model, model class, DTOs, entity, service, controller, RBAC seed, messages, tests) following this skeleton's conventions. Use when asked to add a new feature module / resource / CRUD (e.g. "add a Product module").
---

# New admin module

Build the module the way the existing ones are built. Use
`src/core/admin/global-config/` (simple, paginated) and
`src/core/admin/banner/` / `faq/` (soft delete, restore, uploads, ordering) as
references — read the one closest to the request before writing code.

Ask only for what you can't infer: the fields (name, type, required, unique),
whether it needs soft delete/restore (default: yes), uploads, ordering, or
import/export. Below, `Product` / `product` stand for the new name.

## Steps

1. **Schema** — add the model to `prisma/schema.prisma`:
   `id String @id @default(uuid()) @db.Uuid`, your fields, `createdAt`,
   `updatedAt`, `deletedAt DateTime? @db.Timestamp(6)` (soft delete),
   `@@map("products")`. Index columns you filter/sort on. Then
   `npx prisma migrate dev --name add_product` and `npx prisma generate`.
   Unique columns that are soft-deleted: decide (and say) whether deleted rows
   still reserve the value.

2. **Model** — `src/models/admin/Product.model.ts` with `findAll(datatable)`,
   `countAll(datatable)`, `findOne(id)` (search on `datatable.search`, order by
   `datatable.sort`/`sortDirection`, `skip: offset`, `take: limit`, exclude
   `deletedAt` rows unless asked). Export from `src/models/index.ts`, add to
   `MODELS` in `src/models/models.module.ts`.

3. **DTOs** — `dto/product.dto.ts`: `CreateProductDto`, `UpdateProductDto`.
   class-validator decorators with message keys (`{ message: 'IS_NOT_EMPTY' }`,
   see `validation-messages.ts`), `@ApiProperty` with description + example.
   Use the shared decorators where they fit: `@IsSafeLink()`,
   `@IsFileReference(folder)`, `@NormalizeEmail()`, `UuidPipe`-style
   `@IsUUID`. Add translated field labels to `field-names.ts`.

4. **Entity** — `entities/product.entity.ts`: the response shape for Swagger.

5. **Service** — `product.service.ts`, injecting `HelperService`,
   `PrismaService`, `ProductModel`:
   - `findAll(datatable)` returns `{ pagination: { totalCount, currentPage, lowestNumber, highestNumber }, data }`
     (`lowestNumber` is 0 for an empty page).
   - `findOne`, `create`, `update`, `delete` (soft), `restore`, each taking
     `(…, adminId, request, moduleName)` and calling `this.helper.logAction(...)`.
   - Not found / deleted → `BadRequestException(ErrorMessageHelper.getMultiLanguageMessage('PRODUCT_NOT_FOUND'))`.
   - Writes in `$transaction`; ordinals under `lockScope(tx, orderingScope('product'))`.

6. **Controller** — `product.controller.ts`, route `product`:
   - class: `@ApiTags`, `@ApiBearerAuth()`, `@UseGuards(AdminAuthGuard, PermissionsGuard)`,
     `@RequireModule('Product Management')`, `private readonly moduleName = 'Product Management'`.
   - `const PRODUCT_SORTABLE = [...]` and `toDatatable(...)` in `findAll`, returning `new Paginated(...)`.
   - Routes: `GET /` (View List), `GET /:id` (View Details), `POST /` (Add New, 201),
     `PUT /:id` (Edit), `DELETE /:id` (Delete), `PUT /:id/restore` (Restore).
   - `UuidPipe` on `:id`, `@ResponseMessage`, `@HttpCode`, full Swagger decorators.

7. **Module** — `product.module.ts` (`providers: [ProductService, HelperService]`),
   imported in `src/app.module.ts`.

8. **RBAC seed** — add `'Product Management'` to `prisma/seed/module.seed.ts`
   and to `moduleNames` in `prisma/seed/module-rule.seed.ts` (plus
   `extraRules` for anything beyond the six default rules, e.g. Sorting). The
   rule names must match the `@RequireRule` strings exactly.

9. **Messages** — new keys in `error-messages.ts` (and `success-messages.ts` if
   needed) with both `en` and `id`.

10. **Tests** — `product.service.spec.ts` with mocked dependencies (not found,
    deleted row, happy path). If clients see new behaviour, add an e2e test in
    `test/` using `createTestApp`, `login`, `bearer`.

11. **README** — add the module under "Core Modules".

## Finish

Run `npx tsc --noEmit -p tsconfig.json`, `npm run lint`, `npm test`. Report
what you created (file list), what you ran and the results, and remind the
developer to run the migration + `npx tsx prisma/seed.ts` on their DB and
`! npm run test:e2e` if you added e2e tests.
