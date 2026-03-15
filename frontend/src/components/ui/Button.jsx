import { clsx } from 'clsx';
import { forwardRef } from 'react';

const variants = {
  primary:   'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/30',
  secondary: 'bg-surface-200 hover:bg-surface-300 text-gray-200 border border-white/10',
  accent:    'bg-accent-600 hover:bg-accent-500 text-white shadow-lg shadow-accent-900/30',
  ghost:     'bg-transparent hover:bg-white/5 text-gray-300 hover:text-white',
  danger:    'bg-red-700 hover:bg-red-600 text-white',
  outline:   'bg-transparent border border-white/20 hover:border-white/40 text-gray-300 hover:text-white',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs rounded-md',
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-xl',
};

export const Button = forwardRef(({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  className,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variants[variant] || variants.primary,
      sizes[size]   || sizes.md,
      className,
    )}
    {...props}
  >
    {loading && (
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
));

Button.displayName = 'Button';
