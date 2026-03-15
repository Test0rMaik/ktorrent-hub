const styles = {
  green:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  red:    'bg-red-500/10 text-red-400 border-red-500/20',
  blue:   'bg-brand-500/10 text-brand-400 border-brand-500/20',
  purple: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
  gray:   'bg-white/5 text-gray-400 border-white/10',
  amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[color] || styles.gray} ${className}`}>
      {children}
    </span>
  );
}
