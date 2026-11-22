import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUploader } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

async function main() {
  console.log('--- file-upload-kit: Multiple Upload & Batch Rollback Example ---\n');

  const uploader = createUploader({
    destination: uploadsDir,
    maxFiles: 5,
    maxFileSize: 1024 * 1024, // 1MB
    rollbackOnError: true // Atomic rollback if any file in batch fails
  });

  // 1. Upload multiple files successfully
  const files = [
    { originalName: 'report-part-1.txt', buffer: Buffer.from('Chapter 1 content') },
    { originalName: 'report-part-2.txt', buffer: Buffer.from('Chapter 2 content') },
    { originalName: 'report-part-3.txt', buffer: Buffer.from('Chapter 3 content') }
  ];

  console.log('Uploading batch of 3 files...');
  const batchResult = await uploader.uploadMany(files);

  console.log(`Successfully uploaded ${batchResult.count} files:`);
  for (const f of batchResult.files) {
    console.log(` - ${f.originalName} -> ${f.filename} (${f.size} bytes)`);
  }

  // 2. Demonstrate atomic rollback on failure
  console.log('\nDemonstrating atomic batch rollback...');
  const flawedBatch = [
    { originalName: 'valid-file.txt', buffer: Buffer.from('Valid file') },
    { originalName: 'oversized-file.txt', buffer: Buffer.alloc(2 * 1024 * 1024) } // Exceeds 1MB limit
  ];

  try {
    await uploader.uploadMany(flawedBatch);
  } catch (err) {
    console.log('Batch failed as expected with error:', err.message);
    console.log('Atomic rollback ensured no orphaned files were kept from this batch.');
  }

  // 3. Batch deletion
  console.log('\nCleaning up batch files:');
  const filenamesToDelete = batchResult.files.map((f) => f.filename);
  const deleteResult = await uploader.deleteMany(filenamesToDelete);
  console.log(`Deleted ${deleteResult.count} files cleanly.`);
}

main().catch(console.error);
