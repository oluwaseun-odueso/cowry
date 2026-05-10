import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn() — className merge utility', () => {
  it('joins two simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false && 'b', undefined, null as any, 'c')).toBe('a c');
  });

  it('resolves Tailwind conflicts — last conflicting class wins', () => {
    // tailwind-merge keeps px-4 over px-2
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('resolves conflicting text colours', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('merges conditional object syntax from clsx', () => {
    expect(cn({ 'font-bold': true, italic: false }, 'underline')).toBe('font-bold underline');
  });

  it('returns an empty string when all arguments are falsy', () => {
    expect(cn(false as any, undefined, null as any)).toBe('');
  });

  it('passes non-conflicting Tailwind classes through unchanged', () => {
    const result = cn('flex', 'items-center', 'gap-4');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('gap-4');
  });
});
