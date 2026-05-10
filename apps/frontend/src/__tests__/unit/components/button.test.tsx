import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

// Stub @base-ui/react/button so we can test our wrapper independently
vi.mock('@base-ui/react/button', () => ({
  Button: ({ className, children, disabled, onClick, ...rest }: any) => (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  ),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('Button component', () => {
  describe('rendering', () => {
    it('renders its children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeDefined();
    });

    it('applies the data-slot="button" attribute', () => {
      render(<Button>X</Button>);
      expect(screen.getByText('X').closest('[data-slot="button"]')).not.toBeNull();
    });
  });

  describe('variants', () => {
    it('includes a primary background class for the default variant', () => {
      const { container } = render(<Button variant="default">Default</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain('bg-primary');
    });

    it('includes a destructive class for the destructive variant', () => {
      const { container } = render(<Button variant="destructive">Danger</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain('destructive');
    });

    it('includes a border class for the outline variant', () => {
      const { container } = render(<Button variant="outline">Outline</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain('border');
    });
  });

  describe('sizes', () => {
    it('defaults to size="default"', () => {
      const { container } = render(<Button>Default size</Button>);
      const btn = container.querySelector('button')!;
      // h-8 is the default height class
      expect(btn.className).toContain('h-8');
    });

    it('applies a large size class', () => {
      const { container } = render(<Button size="lg">Large</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain('h-9');
    });
  });

  describe('custom className', () => {
    it('merges a custom className via cn()', () => {
      const { container } = render(<Button className="my-custom-class">Styled</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain('my-custom-class');
    });
  });

  describe('interaction', () => {
    it('fires the onClick handler when clicked', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={onClick}>Click me</Button>);
      await user.click(screen.getByText('Click me'));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not fire onClick when disabled', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(<Button disabled onClick={onClick}>Disabled</Button>);
      const btn = screen.getByText('Disabled');
      await user.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('renders as disabled when the disabled prop is set', () => {
      render(<Button disabled>Disabled</Button>);
      const btn = screen.getByText('Disabled') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });
});
