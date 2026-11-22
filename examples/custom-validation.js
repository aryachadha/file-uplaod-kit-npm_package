import { createUploader, validateFile } from '../src/index.js';

async function main() {
  console.log('--- file-upload-kit: Custom Validation Rules Example ---\n');

  // 1. Configure uploader with custom validation
  const uploader = createUploader({
    destination: './uploads',
    maxFileSize: 2 * 1024 * 1024,
    allowedExtensions: ['.pdf'],
    customValidator: async (file) => {
      // Custom business rule: Invoices must be at least 500 bytes and not contain 'draft'
      if (file.size < 500) {
        return {
          valid: false,
          code: 'INVOICE_TOO_SMALL',
          message: 'Official invoices must be at least 500 bytes.'
        };
      }

      if (file.originalName.toLowerCase().includes('draft')) {
        return {
          valid: false,
          code: 'DRAFT_NOT_ALLOWED',
          message: 'Draft documents cannot be uploaded to the production archive.'
        };
      }

      return { valid: true };
    }
  });

  // 2. Validate without saving using validateFile or uploader.validate
  console.log('Validating draft invoice:');
  const draftFile = {
    originalName: 'draft-invoice-2026.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.5 draft sample')
  };

  const validationResult = await uploader.validate(draftFile);
  console.log('Validation passed:', validationResult.valid);
  console.log('Errors:', validationResult.errors);

  // 3. Valid file
  console.log('\nValidating official invoice:');
  const officialFile = {
    originalName: 'invoice-final-2026.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.5 final invoice content')
  };

  const officialResult = await uploader.validate(officialFile);
  console.log('Validation passed:', officialResult.valid);
  console.log('Errors count:', officialResult.errors.length);
}

main().catch(console.error);
