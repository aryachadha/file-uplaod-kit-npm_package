/**
 * Size utilities for file-upload-kit.
 */

/**
 * Converts bytes to kilobytes with precision.
 * @param {number} bytes
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function bytesToKB(bytes, decimals = 2) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return 0;
  }
  return Number((bytes / 1024).toFixed(decimals));
}

/**
 * Converts bytes to megabytes with precision.
 * @param {number} bytes
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function bytesToMB(bytes, decimals = 2) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return 0;
  }
  return Number((bytes / (1024 * 1024)).toFixed(decimals));
}

/**
 * Formats bytes into a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=2]
 * @returns {string} E.g., "4.50 MB"
 */
export function formatBytes(bytes, decimals = 2) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);
  const value = (bytes / Math.pow(k, unitIndex)).toFixed(decimals);
  return `${parseFloat(value)} ${units[unitIndex]}`;
}
