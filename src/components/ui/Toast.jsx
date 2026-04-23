import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {} };
  }
  return ctx;
}

const INTENT_STYLES = {
  success: { bg: 'bg-emerald-900/80 border-emerald-700', text: 'text-emerald-300', Icon: CheckCircle2 },
  error:   { bg: 'bg-red-900/80 border-red-700',           text: 'text-red-300',     Icon: AlertCircle  },
  info:    { bg: 'bg-slate-800/90 border-slate-700',       text: 'text-slate-200',   Icon: Info         },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message, { intent = 'info', duration = 3000 } = {}) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, message, intent }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const style = INTENT_STYLES[t.intent] || INTENT_STYLES.info;
          const { Icon } = style;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto fade-in flex items-start gap-2 px-3 py-2 rounded-md border backdrop-blur-sm shadow-lg ${style.bg} ${style.text} min-w-[240px] max-w-[380px]`}
              role="status"
            >
              <Icon size={14} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">{t.message}</div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="flex-shrink-0 text-slate-400 hover:text-slate-200"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
