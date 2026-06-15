/**
 * Bir Date nesnesini yerel saat dilimini kullanarak YYYY-MM-DD biçiminde formatlar
 * (toISOString'in neden olduğu UTC kaymasını önler).
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
