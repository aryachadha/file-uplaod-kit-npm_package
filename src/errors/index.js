/**
 * Base custom error class for file-upload-kit.
 */
export class UploadKitError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {string} code - Machine-readable error code.
   * @param {object} [details={}] - Additional non-sensitive context.
   */
  constructor(message, code = 'UPLOAD_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(Object.keys(this.details).length > 0 ? { details: this.details } : {})
    };
  }
}

export class FileTooLargeError extends UploadKitError {
  constructor(message = 'File exceeds the maximum allowed size.', details = {}) {
    super(message, 'FILE_TOO_LARGE', details);
  }
}

export class InvalidFileTypeError extends UploadKitError {
  constructor(message = 'File type is not permitted.', details = {}) {
    super(message, 'INVALID_FILE_TYPE', details);
  }
}

export class InvalidFilenameError extends UploadKitError {
  constructor(message = 'Filename contains invalid or dangerous characters.', details = {}) {
    super(message, 'INVALID_FILENAME', details);
  }
}

export class FileNotFoundError extends UploadKitError {
  constructor(message = 'Specified file was not found.', details = {}) {
    super(message, 'FILE_NOT_FOUND', details);
  }
}

export class StorageError extends UploadKitError {
  constructor(message = 'Storage operation failed.', details = {}) {
    super(message, 'STORAGE_ERROR', details);
  }
}

export class SecurityError extends UploadKitError {
  constructor(message = 'Security violation detected in file path or attributes.', details = {}) {
    super(message, 'SECURITY_VIOLATION', details);
  }
}
