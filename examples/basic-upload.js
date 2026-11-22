import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUploader, getFileInfo, deleteFile } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

async function main() {
  console.log('--- file-upload-kit: Basic Single Upload Example ---\n');

  // 1. Initialize uploader with configuration
  const uploader = createUploader({
    destination: uploadsDir,
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    allowedExtensions: ['.png', '.jpg', '.txt'],
    allowedTypes: ['image/png', 'image/jpeg', 'text/plain']
  });

  // 2. Upload a buffer file
  const fileBuffer = Buffer.from('Hello! This is a sample uploaded file stored via file-upload-kit.');
  console.log('Uploading sample document...');

  const uploadResult = await uploader.upload({
    originalName: 'my document.txt',
    buffer: fileBuffer,
    mimeType: 'text/plain'
  });

  console.log('Upload successful:');
  console.log({
    filename: uploadResult.filename,
    originalName: uploadResult.originalName,
    size: `${uploadResult.sizeInKB} KB`,
    mimeType: uploadResult.mimeType,
    path: uploadResult.path
  });

  // 3. Retrieve metadata
  console.log('\nFetching file metadata:');
  const info = await uploader.getInfo(uploadResult.filename);
  console.log({
    filename: info.filename,
    sizeInKB: info.sizeInKB,
    createdAt: info.createdAt,
    mimeType: info.mimeType
  });

  // 4. Clean up the uploaded example file
  console.log('\nCleaning up uploaded file:');
  const deleteResult = await uploader.delete(uploadResult.filename);
  console.log('Deleted successfully:', deleteResult.success);
}

main().catch(console.error);
