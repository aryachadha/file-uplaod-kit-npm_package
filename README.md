# @aryachadha/file-upload-kit

A modular, framework-independent file upload management library for Node.js applications.

`@aryachadha/file-upload-kit` simplifies file validation, collision-resistant unique naming, secure local storage, file metadata extraction, and safe deletion. It runs with zero external dependencies in core and provides an optional Express integration middleware.

---

## Features

- **Zero-Dependency Core**: Built entirely with Node.js built-in modules (`node:fs/promises`, `node:crypto`, `node:stream`, `node:path`).
- **Binary Content-Signature Detection**: Inspects magic numbers for JPEG, PNG, GIF, WebP, PDF, ZIP, and audio/video formats to combat MIME spoofing.
- **Path Traversal Defense**: Enforces containment within configured base directories, strips control characters, and blocks null-byte injection.
- **Collision-Resistant Filenames**: Generates URL- and filesystem-safe slugs with cryptographic entropy (`crypto.randomBytes`).
- **Atomic Writes & Rollbacks**: Uses temporary atomic file writes; cleans up partial files on failure; provides batch rollbacks if a file in a multi-file upload fails.
- **Stream & Buffer Support**: Handles both in-memory buffers and streaming uploads with real-time byte limits.
- **Custom Synchronous & Asynchronous Validators**: Add business-rule validation easily.
- **Optional Express Middleware**: Directly parses incoming multipart requests or adapts pre-parsed Multer memory storage buffers.

---

## Installation

```bash
npm install @aryachadha/file-upload-kit
```

Requires Node.js `>= 18.0.0`.

---

## Quick-Start Example

```javascript
import { createUploader } from "@aryachadha/file-upload-kit";

// 1. Initialize uploader instance
const uploader = createUploader({
  destination: "./uploads",
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  allowedExtensions: [".png", ".jpg", ".pdf"],
  allowedTypes: ["image/png", "image/jpeg", "application/pdf"]
});

// 2. Upload a file buffer
const result = await uploader.upload({
  originalName: "profile-picture.png",
  buffer: imageBuffer,
  mimeType: "image/png"
});

console.log("File saved to:", result.path);
console.log("Generated filename:", result.filename);
```

---

## Configuration Options

When creating an uploader instance via `createUploader(config)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `destination` | `string` | `"./uploads"` | Directory where files will be stored. Created automatically if missing. |
| `maxFileSize` | `number` | `5242880` (5MB) | Maximum allowed file size in bytes. |
| `minFileSize` | `number` | `1` | Minimum allowed file size in bytes. Set `allowEmpty: true` for 0-byte files. |
| `allowEmpty` | `boolean` | `false` | Whether 0-byte files are accepted. |
| `allowedExtensions` | `string[]` | `[]` | Allowed extensions, e.g. `['.png', '.jpg', '.pdf']` (case-insensitive). |
| `allowedTypes` | `string[]` | `[]` | Allowed MIME types or wildcard patterns, e.g. `['image/*', 'application/pdf']`. |
| `maxFiles` | `number` | `10` | Maximum number of files permitted in a single batch upload. |
| `rollbackOnError` | `boolean` | `true` | When uploading batches, deletes previously saved files if a later file fails. |
| `throwOnError` | `boolean` | `true` | When `false`, returns `{ success: false, errors: [...] }` instead of throwing. |
| `customValidator` | `Function` | `null` | Synchronous or asynchronous validator `(file) => { valid, message, code }`. |

---

## Single-File Upload

Supports Buffers and Readable streams:

```javascript
import { createUploader } from "@aryachadha/file-upload-kit";
import fs from "node:fs";

const uploader = createUploader({ destination: "./uploads/documents" });

// Buffer upload
const uploadResult = await uploader.upload({
  originalName: "contract.pdf",
  buffer: fileBuffer,
  mimeType: "application/pdf"
});

// Stream upload with chunk limit monitoring
const readStream = fs.createReadStream("./source.txt");
const streamResult = await uploader.upload({
  originalName: "streamed-notes.txt",
  stream: readStream,
  mimeType: "text/plain"
});
```

Upload return object:

```javascript
{
  success: true,
  filename: "contract-49f1a20b8e72c1d3.pdf",
  originalName: "contract.pdf",
  path: "/path/to/uploads/documents/contract-49f1a20b8e72c1d3.pdf",
  destination: "/path/to/uploads/documents",
  size: 245678,
  sizeInKB: 239.92,
  sizeInMB: 0.23,
  mimeType: "application/pdf",
  extension: ".pdf",
  createdAt: "2026-11-22T10:30:00.000Z"
}
```

---

## Multiple-File Upload

Upload multiple files concurrently with batch size limits and atomic rollback:

```javascript
import { createUploader } from "@aryachadha/file-upload-kit";

const uploader = createUploader({
  destination: "./uploads/documents",
  maxFiles: 5,
  rollbackOnError: true
});

const batch = [
  { originalName: "doc1.pdf", buffer: buffer1 },
  { originalName: "doc2.pdf", buffer: buffer2 },
  { originalName: "doc3.pdf", buffer: buffer3 }
];

const batchResult = await uploader.uploadMany(batch);
console.log(`Uploaded ${batchResult.count} files.`);
// batchResult.files contains individual metadata objects
```

If one file fails validation or storage writing, `rollbackOnError: true` unlinks any previously written files from that batch, preventing partial orphaned uploads.

---

## File Validation

Validate files without writing to storage using `validateFile`:

```javascript
import { validateFile } from "@aryachadha/file-upload-kit";

const result = await validateFile(fileInput, {
  maxFileSize: 2 * 1024 * 1024,
  allowedExtensions: [".jpg", ".png"],
  allowedTypes: ["image/jpeg", "image/png"]
});

if (!result.valid) {
  console.error("Validation failed:", result.errors);
  // [ { code: "FILE_TOO_LARGE", message: "..." } ]
}
```

Validation rules include:
- `FILE_MISSING`: No file provided.
- `FILE_EMPTY`: File is 0 bytes when `allowEmpty` is false.
- `FILE_TOO_LARGE`: Exceeds `maxFileSize`.
- `FILE_TOO_SMALL`: Under `minFileSize`.
- `INVALID_FILE_EXTENSION`: Extension not in `allowedExtensions`.
- `INVALID_MIME_TYPE`: MIME type not in `allowedTypes`.
- `MIME_TYPE_MISMATCH`: Binary magic byte signature does not match client claim (MIME spoofing).
- `INVALID_FILENAME`: Null bytes or dangerous traversal sequences detected.

---

## Custom Validation

Implement synchronous or asynchronous business rules:

```javascript
import { createUploader } from "@aryachadha/file-upload-kit";

const uploader = createUploader({
  destination: "./uploads",
  customValidator: async (file) => {
    if (file.size < 500) {
      return {
        valid: false,
        code: "FILE_TOO_SMALL",
        message: "File must be at least 500 bytes."
      };
    }

    if (file.originalName.startsWith("temp-")) {
      return {
        valid: false,
        code: "INVALID_PREFIX",
        message: "Prefix 'temp-' is not allowed."
      };
    }

    return { valid: true };
  }
});
```

---

## File Metadata

Retrieve filesystem metadata and verified MIME signatures:

```javascript
import { getFileInfo } from "@aryachadha/file-upload-kit";

const info = await getFileInfo("./uploads/example.png");
console.log(info);
/*
{
  exists: true,
  filename: "example.png",
  extension: ".png",
  mimeType: "image/png",
  detectedMime: "image/png",
  size: 245678,
  sizeInKB: 239.92,
  sizeInMB: 0.23,
  path: "/absolute/path/to/uploads/example.png",
  createdAt: "2026-11-22T10:15:00.000Z",
  modifiedAt: "2026-11-22T10:15:00.000Z"
}
*/
```

---

## File Deletion

Delete files safely with boundary checks:

```javascript
import { deleteFile, deleteMultipleFiles } from "@aryachadha/file-upload-kit";

// Direct deletion
const res = await deleteFile("./uploads/old-file.txt");

// Uploader instance deletion (strictly confined to uploader destination)
await uploader.delete("avatar-123.png");

// Batch deletion
const batchRes = await uploader.deleteMany(["file1.png", "file2.png"]);
console.log(`Deleted ${batchRes.count} files.`);
```

---

## Express Integration

The optional Express integration allows mounting upload handling into Express routes:

```javascript
import express from "express";
import { createUploadMiddleware } from "@aryachadha/file-upload-kit/express";

const app = express();

// Single file upload route
app.post(
  "/api/avatar",
  createUploadMiddleware.single("avatar", {
    destination: "./uploads/avatars",
    maxFileSize: 2 * 1024 * 1024,
    allowedExtensions: [".png", ".jpg"]
  }),
  (req, res) => {
    res.json({ message: "Avatar uploaded", file: req.file, body: req.body });
  }
);

// Multiple files upload route
app.post(
  "/api/documents",
  createUploadMiddleware.array("docs", 5, {
    destination: "./uploads/documents",
    maxFileSize: 10 * 1024 * 1024,
    allowedExtensions: [".pdf", ".docx"]
  }),
  (req, res) => {
    res.json({ message: "Documents uploaded", files: req.files });
  }
);

// Central error handler
app.use((err, req, res, next) => {
  res.status(400).json({
    name: err.name,
    code: err.code || "UPLOAD_ERROR",
    message: err.message
  });
});
```

---

## Error Handling

Standardized error classes inherit from `UploadKitError`:

| Error Class | Code | Cause |
|---|---|---|
| `FileTooLargeError` | `FILE_TOO_LARGE` | File exceeds maximum byte limit. |
| `InvalidFileTypeError` | `INVALID_FILE_TYPE` | Extension or MIME type not allowed, or MIME spoofing detected. |
| `InvalidFilenameError` | `INVALID_FILENAME` | Filename contains null bytes or illegal characters. |
| `FileNotFoundError` | `FILE_NOT_FOUND` | File does not exist during deletion or info retrieval. |
| `StorageError` | `STORAGE_ERROR` | Filesystem I/O error occurred. |
| `SecurityError` | `SECURITY_VIOLATION` | Path traversal or directory escape detected. |

Each error instance provides a sanitized `.toJSON()` format for REST API responses.

---

## Security Considerations

1. **Never trust client filenames**: The library generates cryptographically unique filenames by default to avoid directory collisions and code execution vulnerabilities.
2. **Path Traversal Protection**: All paths are resolved and verified using `path.relative` containment checks. Attempts to escape root directories throw `SecurityError`.
3. **MIME Verification**: Inspects file headers (magic bytes) to catch file-type masquerading.
4. **Automatic Cleanup**: Incomplete or aborted uploads are cleaned up immediately from temporary storage.
5. **Malware Notice**: While content signatures are inspected, this library does not scan files for malicious bytecode or viruses. Production deployments should pass uploaded files through an external antivirus scanner.

---

## Limitations

- **Plain-Text Formats**: Magic numbers identify binary file formats (JPEG, PNG, PDF, ZIP, WebP, etc.). Plain-text formats (CSV, JSON, XML, TXT) do not contain fixed magic byte signatures and rely on extension and client header validation.
- **Archive Formats**: Modern Office documents (DOCX, XLSX) share the ZIP container magic signature (`PK\x03\x04`).

---

## Contribution Guidelines

1. Ensure all code uses ES Modules and Node.js built-in modules wherever practical.
2. Write tests using the native Node.js test runner (`node:test`).
3. Run tests before submitting changes:
   ```bash
   npm test
   ```
4. Adhere to secure coding practices and maintain path traversal defenses.

---

## License

MIT
