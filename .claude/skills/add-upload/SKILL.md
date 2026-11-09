---
name: add-upload
description: Add file upload (image/video, or a new file type) to a module using the shared StorageService, upload.config.ts registry and withUpload replacement flow. Use when a module needs to accept, replace, store or delete files.
---

# Add uploads to a module

Uploads are shared infrastructure. Never write per-module file checks, folder
strings or delete logic — extend the registry instead. Full recipe: README
"File Upload & Storage". Reference implementations: `banner` (image + video)
and `admin-account` (avatar replace).

## Steps

1. **Register the folder** in `UPLOAD_FOLDERS`
   (`src/common/config/upload.config.ts`), e.g. `'product-image'`. The type
   `UploadFolder` comes from this list, and `deleteFile()` refuses anything
   outside it.

2. **New file type?** (e.g. PDF) add a `FILE_TYPES` entry with its magic
   bytes; a new kind also needs `FileKind` + `UPLOAD_SIZE_LIMITS`. Add a test
   in `upload.config.spec.ts` / `file-type.helper.spec.ts`.

3. **Controller** — multer pre-check (what the client *claims*; cheap, early
   422) with the shared settings from `src/common/config/image.config.ts`,
   exactly like `admin.controller.ts` (avatar) / `banner.controller.ts` (media):
   ```ts
   @UseInterceptors(
     FileInterceptor('image', {
       limits: { fileSize: defaultMaxFileSize },        // defaultMaxVideoFileSize for media
       fileFilter: (req, file, cb) =>
         file.mimetype.match(defaultAllowedImageTypeRegex) // …MediaTypeRegex for media
           ? cb(null, true)
           : cb(invalidMimesType(defaultAllowedImageTypes, ['image']), false),
     }),
   )
   ```
   Routes that take form fields but no files use `NoFilesInterceptor()`
   (never `AnyFilesInterceptor` — it buffers unlimited files).

4. **Store** in the service:
   ```ts
   const stored = await this.storageService.uploadFile(file, {
     folder: 'product-image', prefix: 'product', identifier: dto.name,
     accept: ['image'],            // ['image', 'video'] for media
   });
   ```
   Content is checked by bytes → 422 `UNSUPPORTED_FILE_CONTENT` otherwise.

5. **Replace** an existing file with `withUpload`, so the old file is deleted
   only after the DB save succeeds and a failed save removes the new upload:
   ```ts
   await this.storageService.withUpload(
     { file, options: { folder: 'product-image', prefix: 'product' }, replaces: product.imageUrl },
     (imageUrl) => tx.product.update({ where: { id }, data: { imageUrl: imageUrl ?? undefined } }),
   );
   ```

6. **File references from clients** (URL in JSON body or import row) —
   `@IsFileReference('product-image')` in the DTO, `isFileReference()` in
   import code. Never pass an unvalidated client string to `deleteFile()`.

7. **Tests** — e2e: a real PNG is accepted, an HTML file renamed `.png` → 422,
   replacing keeps the old file when the save fails (see
   `test/security.e2e-spec.ts` and `test/data.e2e-spec.ts`).

Works the same for `DISK_STORAGE=local | s3 | obs`; don't branch on the
provider in module code.
