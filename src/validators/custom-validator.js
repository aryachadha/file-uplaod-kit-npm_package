/**
 * Executes a developer-supplied custom validator function.
 * Supports both synchronous and asynchronous validators.
 *
 * @param {object} file - Normalized file descriptor.
 * @param {Function} customValidator - Validator function.
 * @returns {Promise<Array<{ code: string, message: string }>>}
 */
export async function executeCustomValidator(file, customValidator) {
  const errors = [];
  if (typeof customValidator !== 'function') {
    return errors;
  }

  try {
    const result = await customValidator(file);

    if (!result) return errors;

    if (result.valid === false) {
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push({
            code: err.code || 'CUSTOM_VALIDATION_FAILED',
            message: err.message || 'Custom validation failed.'
          });
        }
      } else {
        errors.push({
          code: result.code || 'CUSTOM_VALIDATION_FAILED',
          message: result.message || 'Custom validation failed.'
        });
      }
    }
  } catch (err) {
    errors.push({
      code: 'CUSTOM_VALIDATOR_ERROR',
      message: err.message || 'An error occurred during custom file validation.'
    });
  }

  return errors;
}
