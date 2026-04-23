import { useState, useRef, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import Button from './Button.jsx';

export default function ConfirmButton({
  onConfirm,
  triggerLabel,
  triggerIcon: TriggerIcon,
  triggerVariant = 'ghost',
  triggerClassName = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  icon: Icon = Trash2,
  ariaLabel = 'Delete',
  variant = 'danger',
  size = 'xs',
  timeoutMs = 5000,
  className = '',
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const start = () => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), timeoutMs);
  };
  const cancel = () => {
    setConfirming(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  const confirm = () => {
    cancel();
    onConfirm();
  };

  if (!confirming) {
    if (triggerLabel) {
      return (
        <Button
          variant={triggerVariant}
          size={size}
          icon={TriggerIcon}
          onClick={start}
          className={`${triggerClassName} ${className}`}
          aria-label={ariaLabel}
        >
          {triggerLabel}
        </Button>
      );
    }
    return (
      <Button
        variant="ghost"
        size={size}
        iconOnly
        icon={Icon}
        aria-label={ariaLabel}
        onClick={start}
        className={`text-red-500/60 hover:text-red-400 ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Button variant={variant} size={size} onClick={confirm}>
        {confirmLabel}
      </Button>
      <Button
        variant="ghost"
        size={size}
        iconOnly
        icon={X}
        aria-label={cancelLabel}
        onClick={cancel}
      />
    </div>
  );
}
