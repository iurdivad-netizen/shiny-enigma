export default function EmptyState({
  icon: Icon,
  title,
  helper,
  action,
  className = '',
  size = 'md',
}) {
  const paddings = {
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12',
  };
  const iconSize = size === 'lg' ? 40 : size === 'sm' ? 20 : 28;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${paddings[size]} ${className}`}>
      {Icon && <Icon size={iconSize} className="text-slate-700" strokeWidth={1.2} />}
      {title && <div className="text-slate-400 text-sm font-medium">{title}</div>}
      {helper && <div className="text-slate-600 text-xs max-w-md">{helper}</div>}
      {action && <div className="mt-1 flex items-center gap-2 flex-wrap justify-center">{action}</div>}
    </div>
  );
}
