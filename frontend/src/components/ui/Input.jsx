import { forwardRef } from 'react';

export const Input = forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-gray-300">{label}</label>}
    <input
      ref={ref}
      className={`
        w-full px-3 py-2 bg-surface-100 border rounded-lg text-sm text-white placeholder-gray-500
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        ${error ? 'border-red-500' : 'border-white/10 hover:border-white/20'}
        ${className}
      `}
      {...props}
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
));

export const Textarea = forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-gray-300">{label}</label>}
    <textarea
      ref={ref}
      className={`
        w-full px-3 py-2 bg-surface-100 border rounded-lg text-sm text-white placeholder-gray-500
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
        disabled:opacity-50 resize-vertical min-h-[80px]
        ${error ? 'border-red-500' : 'border-white/10 hover:border-white/20'}
        ${className}
      `}
      {...props}
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
));

export const Select = forwardRef(({ label, error, className = '', children, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-gray-300">{label}</label>}
    <select
      ref={ref}
      className={`
        w-full px-3 py-2 bg-surface-100 border rounded-lg text-sm text-white
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
        disabled:opacity-50 cursor-pointer
        ${error ? 'border-red-500' : 'border-white/10 hover:border-white/20'}
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
));

Input.displayName    = 'Input';
Textarea.displayName = 'Textarea';
Select.displayName   = 'Select';
