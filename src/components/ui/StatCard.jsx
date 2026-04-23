const SIGN_COLORS = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-slate-200',
  muted: 'text-slate-400',
  accent: 'text-blue-400',
};

export default function StatCard({
  label,
  value,
  sign = 'neutral',
  mono = true,
  sub,
  size = 'md',
  className = '',
}) {
  const labelCls =
    size === 'sm'
      ? 'text-[10px] text-slate-500 uppercase tracking-wider'
      : 'text-[10px] text-slate-500 uppercase tracking-wider';
  const valueSize = size === 'sm' ? 'text-sm' : 'text-base';
  const valueCls = `${valueSize} font-semibold ${mono ? 'font-mono' : ''} ${SIGN_COLORS[sign] || SIGN_COLORS.neutral}`;

  return (
    <div className={className}>
      <div className={labelCls}>{label}</div>
      <div className={valueCls}>{value}</div>
      {sub != null && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
