import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

const STYLES = {
  error: {
    container: 'bg-red-900/20 border border-red-800/50 text-red-400',
    Icon: AlertCircle,
  },
  warning: {
    container: 'bg-amber-900/20 border border-amber-800/50 text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-slate-900/40 border border-slate-700 text-slate-400',
    Icon: Info,
  },
};

export default function ErrorBox({
  intent = 'error',
  title,
  children,
  icon: IconOverride,
  className = '',
  compact = false,
}) {
  const { container, Icon: DefaultIcon } = STYLES[intent] || STYLES.error;
  const Icon = IconOverride || DefaultIcon;
  const padding = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs';

  return (
    <div className={`flex items-start gap-2 rounded ${container} ${padding} ${className}`} role={intent === 'error' ? 'alert' : 'status'}>
      <Icon size={13} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        {children && <div className={title ? 'text-[11px] opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}
