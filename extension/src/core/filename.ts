const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

export function sanitizeFilename(input: string): string {
  if (!input || input.trim() === '') return '_unnamed';

  let cleaned = input
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/^\.+$/, '_')
    .trim();

  const upper = cleaned.toUpperCase().replace(/\.[^.]*$/, '');
  if (RESERVED_NAMES.includes(upper)) {
    cleaned = `_${cleaned}`;
  }

  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 100);
  }

  return cleaned || '_unnamed';
}

export function padPageNumber(pageIndex: number, totalPages: number): string {
  const digits = Math.max(4, String(totalPages).length);
  return String(pageIndex).padStart(digits, '0');
}
