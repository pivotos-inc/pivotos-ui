/** 日期格式化：yyyy-MM-dd HH:mm:ss 风格占位符 */
export function formatDate(date: Date | string | number, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  return pattern
    .replace('yyyy', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('dd', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}
