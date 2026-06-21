import { describe, expect, it } from 'vitest';
import { sanitizeFilename, padPageNumber } from '../src/core/filename';

describe('filename utilities', () => {
  it('sanitizes filenames to prevent path traversal and reserved names', () => {
    expect(sanitizeFilename('Hello World')).toBe('Hello World');
    expect(sanitizeFilename('../etc/passwd')).toBe('__etc_passwd');
    expect(sanitizeFilename('..\\windows\\system32')).toBe('__windows_system32');
    expect(sanitizeFilename('file/name')).toBe('file_name');
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('PRN')).toBe('_PRN');
    expect(sanitizeFilename('')).toBe('_unnamed');
    expect(sanitizeFilename('a'.repeat(200))).toHaveLength(100);
  });

  it('pads page numbers with zero padding', () => {
    expect(padPageNumber(1, 100)).toBe('0001');
    expect(padPageNumber(42, 100)).toBe('0042');
    expect(padPageNumber(100, 100)).toBe('0100');
  });
});
