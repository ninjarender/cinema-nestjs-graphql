/** Код помилки MongoDB «порушено унікальний індекс» (duplicate key). */
export const DUPLICATE_KEY = 11000;

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
