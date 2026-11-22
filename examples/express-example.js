import { createUploadMiddleware } from '../src/middleware/express.js';

/**
 * Example demonstrating how to integrate file-upload-kit in an Express application.
 *
 * To run with real Express:
 * 1. npm install express
 * 2. node examples/express-example.js
 */

// Simulated / documented Express pattern
export function configureApp(app) {
  // Single-file upload endpoint
  app.post(
    '/api/avatar',
    createUploadMiddleware({
      destination: './uploads/avatars',
      maxFileSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/png', 'image/jpeg'],
      allowedExtensions: ['.png', '.jpg', '.jpeg'],
      fieldName: 'avatar',
      single: true
    }),
    (req, res) => {
      res.json({
        message: 'Avatar uploaded successfully',
        file: req.file,
        user: req.body
      });
    }
  );

  // Multi-file upload endpoint
  app.post(
    '/api/documents',
    createUploadMiddleware({
      destination: './uploads/documents',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      allowedExtensions: ['.pdf', '.docx', '.txt']
    }),
    (req, res) => {
      res.json({
        message: 'Documents uploaded successfully',
        count: req.files.length,
        files: req.files
      });
    }
  );

  // Centralized structured error handler
  app.use((err, req, res, next) => {
    console.error('Upload Error:', err.message);

    res.status(400).json({
      error: err.name || 'UploadError',
      code: err.code || 'UPLOAD_ERROR',
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  });
}

console.log('Express integration configured successfully.');
console.log('See examples/express-example.js for copy-paste implementation with express.');
