import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/40 disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-700',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700',
  ghost:
    'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 disabled:text-slate-600 disabled:border-slate-800',
  danger:
    'bg-red-600/80 hover:bg-red-500 text-white border border-red-500/40 disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-700',
  success:
    'bg-emerald-700/40 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-600/40 hover:border-emerald-500/60 disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-700',
};

const SIZES = {
  xs: 'px-2 py-0.5 text-[11px] rounded gap-1',
  sm: 'px-2.5 py-1 text-xs rounded gap-1',
  md: 'px-3 py-1.5 text-xs font-medium rounded gap-1.5',
  lg: 'px-4 py-2 text-sm font-medium rounded-md gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  icon: Icon,
  children,
  className = '',
  type = 'button',
  disabled,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:cursor-not-allowed';
  const pad = iconOnly ? 'p-1.5 rounded' : SIZES[size];

  if (iconOnly && !props['aria-label']) {
    console.warn('[Button] iconOnly buttons require an aria-label prop.');
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${VARIANTS[variant]} ${pad} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'lg' ? 14 : 12} className="animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'lg' ? 14 : 12} />
      ) : null}
      {!iconOnly && children}
    </button>
  );
}
