import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Collapsible({
  title,
  icon: Icon,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
  headerExtra,
  className = '',
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    if (onToggle) onToggle(!isOpen);
    if (!isControlled) setInternalOpen(!isOpen);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 focus-visible:outline-none focus-visible:text-slate-200"
        >
          {Icon && <Icon size={13} />}
          {title}
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {headerExtra}
      </div>
      {isOpen && <div className="fade-in mt-2">{children}</div>}
    </div>
  );
}
