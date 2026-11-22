import { UploadKitError, FileTooLargeError } from '../errors/index.js';

/**
 * Extracts boundary string from Content-Type header.
 * @param {string} contentType
 * @returns {string|null}
 */
export function extractBoundary(contentType) {
  if (!contentType || typeof contentType !== 'string') return null;
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match ? (match[1] || match[2]).trim() : null;
}

/**
 * Parses header string into key-value attributes and parameters.
 * @param {string} headerStr
 * @returns {{ disposition: string, name?: string, filename?: string, contentType?: string }}
 */
export function parsePartHeaders(headerStr) {
  const result = { disposition: 'form-data', name: '', filename: '', contentType: 'text/plain' };
  const lines = headerStr.split(/\r?\n/);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const headerName = line.slice(0, colonIndex).trim().toLowerCase();
    const headerValue = line.slice(colonIndex + 1).trim();

    if (headerName === 'content-disposition') {
      const nameMatch = headerValue.match(/name="([^"]+)"/i);
      const filenameMatch = headerValue.match(/filename="([^"]*)"/i);
      if (nameMatch) result.name = nameMatch[1];
      if (filenameMatch) result.filename = filenameMatch[1];
    } else if (headerName === 'content-type') {
      result.contentType = headerValue.split(';')[0].trim().toLowerCase();
    }
  }

  return result;
}

/**
 * Parses a raw multipart request stream into structured files and body fields.
 *
 * @param {import('node:http').IncomingMessage} req - Incoming HTTP request.
 * @param {object} [options={}]
 * @param {number} [options.maxFileSize] - Maximum size allowed for individual files or body.
 * @param {number} [options.maxTotalSize] - Maximum allowed total body bytes.
 * @returns {Promise<{ files: Array<object>, body: Record<string, string> }>}
 */
export async function parseMultipartStream(req, options = {}) {
  const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
  const boundary = extractBoundary(contentType);

  if (!boundary) {
    throw new UploadKitError('Missing or invalid multipart boundary in Content-Type header.', 'INVALID_MULTIPART_BOUNDARY');
  }

  const maxTotalSize = options.maxTotalSize || (options.maxFileSize ? options.maxFileSize * 2 : 50 * 1024 * 1024);
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxTotalSize) {
      throw new FileTooLargeError(`Upload payload exceeded maximum size limit of ${maxTotalSize} bytes.`);
    }
    chunks.push(chunk);
  }

  const bodyBuffer = Buffer.concat(chunks);
  const delim = Buffer.from(`--${boundary}`);
  let pos = 0;
  const parts = [];

  while (pos < bodyBuffer.length) {
    const idx = bodyBuffer.indexOf(delim, pos);
    if (idx === -1) break;

    if (pos !== 0) {
      let part = bodyBuffer.subarray(pos, idx);
      // Remove trailing CRLF before delimiter
      if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
        part = part.subarray(0, part.length - 2);
      }
      parts.push(part);
    }

    pos = idx + delim.length;
    // Check for trailing "--" indicating end of multipart
    if (bodyBuffer[pos] === 45 && bodyBuffer[pos + 1] === 45) {
      break;
    }
    // Skip CRLF after delimiter
    if (bodyBuffer[pos] === 13 && bodyBuffer[pos + 1] === 10) {
      pos += 2;
    }
  }

  const files = [];
  const body = {};

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;

    const headerStr = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const parsed = parsePartHeaders(headerStr);

    if (parsed.filename !== undefined && parsed.filename !== '') {
      files.push({
        fieldName: parsed.name,
        originalName: parsed.filename,
        mimeType: parsed.contentType || 'application/octet-stream',
        buffer: content,
        size: content.length
      });
    } else if (parsed.name) {
      body[parsed.name] = content.toString('utf8');
    }
  }

  return { files, body };
}
