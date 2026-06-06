# M12 — File Uploads

> Source of truth for file handling. Cloudinary is the source of truth for file bytes; the DB stores only metadata and URLs.

## M12.1 Purpose

- Provide a unified upload flow for RFQ attachments, vendor documents, PO PDFs (generated), and invoice PDFs (generated).
- Store files in Cloudinary.
- Persist file metadata in PostgreSQL via a polymorphic `FileAsset` table.
- Enforce size, type, and ownership rules.
- Never store raw bytes in the database.

## M12.2 Scope

**In scope**:
- Upload via the API (multipart) for user-uploaded files (RFQ attachments, vendor documents).
- Generation of PO and Invoice PDFs on the server.
- Listing and downloading files.
- Deleting files (with ownership and state checks).
- Virus scan stub (Cloudinary's built-in `moderation` for image; manual review flag for raw).

**Out of scope**:
- Direct browser-to-Cloudinary uploads (signed preset) — planned v1.1.
- File versioning.
- Image transformations (basic transformations via Cloudinary are auto-applied for `next/image` only).
- Folder-level access control beyond owner checks.

## M12.3 Entities

- `FileAsset` (polymorphic, see [07-DATA-MODEL.md](../02-architecture/07-DATA-MODEL.md) §7.2).

## M12.4 Upload endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/api/v1/files/upload` | ADMIN, OFFICER, VENDOR (own) | multipart. Body: `file` (binary), `ownerType` (RFQ \| VENDOR_COMPANY), `ownerId` (uuid). |
| GET | `/api/v1/files/:id` | any auth (with ownership) | Metadata |
| GET | `/api/v1/files/:id/download` | any auth (with ownership) | Redirect to Cloudinary signed URL (or stream) |
| DELETE | `/api/v1/files/:id` | ADMIN, OFFICER (own RFQ), VENDOR (own vendor doc, but only in PENDING state) | Removes from Cloudinary and DB |

### Module-specific endpoints (preferred)

Most modules expose their own file endpoints that delegate to `FileService`:

- `POST /api/v1/rfqs/:id/attachments` (multipart)
- `DELETE /api/v1/rfqs/:id/attachments/:fileId`
- `GET /api/v1/rfqs/:id/attachments`
- `POST /api/v1/vendor-companies/:id/documents` (multipart)
- `DELETE /api/v1/vendor-companies/:id/documents/:fileId`
- `GET /api/v1/vendor-companies/:id/documents`

These provide better ownership semantics (e.g., the RFQ must be in DRAFT to upload). The generic `/files/upload` exists for shared utilities.

## M12.5 Cloudinary configuration

- Folder structure: `vendorbridge/<ownerType>/<ownerId>/<fileId>`.
  - Example: `vendorbridge/rfq/abc-123/xyz-789`.
- Resource type: `raw` for PDFs, `image` for JPG/PNG, `auto` for unknown.
- Public IDs are generated server-side as `fileId` (uuid) to keep them unique.
- Signed URLs are used for downloads in production (with a 5-minute expiry).
- Unsigned URLs are used in dev for convenience.

## M12.6 Upload flow (server-side)

```
1. Client sends multipart/form-data with file + ownerType + ownerId.
2. API validates:
   - File size ≤ MAX_SIZE (10 MB).
   - MIME type in ALLOWED_TYPES.
   - File name length ≤ 255.
   - Owner exists and the user has upload rights.
3. API streams file to a temp buffer.
4. API uploads to Cloudinary with the appropriate resource_type.
5. Cloudinary returns public_id and url.
6. API inserts FileAsset row with the metadata.
7. API returns the FileAsset in the response.
```

Implementation uses `multer` (NestJS file interceptor) + the `cloudinary` SDK's `uploader.upload_stream` for streaming.

## M12.7 Generated files (PO, Invoice PDFs)

- Generated server-side using `@react-pdf/renderer`.
- Stored in Cloudinary under `vendorbridge/generated/<ownerType>/<ownerId>/<fileId>.pdf`.
- The corresponding `FileAsset` row has `ownerType = PURCHASE_ORDER` or `INVOICE`, and is read-only.
- Re-generation overwrites the Cloudinary asset (same public_id) and updates the `url` and `updatedAt` on the file asset row.

## M12.8 Validation rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-FU-1 | Max file size: 10 MB | Multer + service |
| BR-FU-2 | Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png` | Service |
| BR-FU-3 | Filename length ≤ 255 | Zod |
| BR-FU-4 | Owner must exist | Service |
| BR-FU-5 | User must have upload rights to the owner | Service (ownership + role) |
| BR-FU-6 | RFQ attachments can be uploaded only in DRAFT state | RFQ service |
| BR-FU-7 | Vendor documents can be uploaded only in PENDING_VERIFICATION or ACTIVE state | Vendor service |

## M12.9 Download flow

- `GET /files/:id/download` returns a 302 redirect to a Cloudinary signed URL (5-minute TTL).
- For non-Cloudinary URLs (none in v1), the API would proxy-stream the file.
- The `download` endpoint is logged (`FILE_DOWNLOADED` audit event).

## M12.10 Delete flow

- `DELETE /files/:id` removes the file from Cloudinary and the DB row.
- State-dependent: e.g., RFQ attachments can be deleted only when RFQ is in DRAFT.
- Audit: `FILE_DELETED` with the file metadata.
- Idempotent: deleting an already-deleted file returns 404.

## M12.11 Security

- All uploads go through the API (no direct browser → Cloudinary in v1).
- File content scanning: in v1, we rely on Cloudinary's `moderation: "aws_rek"` for images (best-effort). For PDFs, no automatic scan. Admin reviews vendor documents manually.
- The Cloudinary API secret is in env vars; never in code.
- Signed URLs only in production.
- CORS for Cloudinary is configured to allow only our frontend origin.

## M12.12 Audit events

| Event | Trigger |
|-------|---------|
| `FILE_UPLOADED` | Upload success |
| `FILE_DOWNLOADED` | Download endpoint called |
| `FILE_DELETED` | Delete action |

## M12.13 Notifications

- For vendor document upload: in-app to admin ("Vendor X uploaded a new document").
- For RFQ attachment upload: in-app to officers on the RFQ (informational; not in v1 if too noisy — admin only).

## M12.14 Edge cases

| Scenario | Behavior |
|----------|----------|
| File exceeds 10 MB | 400 `FILE_TOO_LARGE` |
| File type not allowed | 400 `UNSUPPORTED_FILE_TYPE` |
| Cloudinary upload fails | 502 `STORAGE_UNAVAILABLE`. The DB row is not created. The client can retry. |
| Cloudinary upload succeeds, DB insert fails | Orphan in Cloudinary. A daily cleanup job (planned v1.1) reconciles. In v1, manual cleanup. |
| User uploads to an RFQ that is not theirs (not in their assignments) | 403 `OWNERSHIP_DENIED` |
| User uploads to a vendor that is not theirs (vendor user) | 403 `OWNERSHIP_DENIED` |
| Concurrent uploads to the same owner | Allowed. Each gets a unique `fileId`. |
| Download URL expires before the user clicks | Re-fetch the download endpoint. |
| File is malicious (e.g., embedded script) | Cloudinary's moderation flags it; in v1, we trust the moderation. v1.1 adds explicit AV scan. |
| Filename contains `../` (path traversal) | Sanitized. The stored filename is the original (sanitized) but Cloudinary uses the `fileId` (uuid) as the public ID, not the filename. |

## M12.15 Future (not in v1)

- Direct browser-to-Cloudinary uploads (signed preset) for large files.
- AV scan (ClamAV) for PDFs.
- File previews in the UI (PDF.js for PDFs).
- Image transformations via Cloudinary's URL params.
- File versioning.
- File comments / annotations.
- Bulk download (zip).
