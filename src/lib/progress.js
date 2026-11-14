/**
 * Percentage (0-100) of required fields that contain a non-blank value.
 * Fields equal to their placeholder value (e.g. a bare "+91 " prefix) count as empty.
 * @param {Array<{ value: string, emptyValue?: string }>} fields
 */
export function completionPercent(fields) {
  if (fields.length === 0) return 0;
  const filled = fields.filter(({ value, emptyValue = '' }) => {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed !== emptyValue.trim();
  }).length;
  return Math.round((filled / fields.length) * 100);
}
