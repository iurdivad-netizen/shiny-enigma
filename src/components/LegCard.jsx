import { Eye, EyeOff, Copy } from 'lucide-react';
import Button from './ui/Button.jsx';
import ConfirmButton from './ui/ConfirmButton.jsx';

const LEG_COLORS = ['#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#22d3ee', '#e879f9'];

export default function LegCard({
  leg,
  index,
  greeks,
  legDte,
  isAtm,
  isItm,
  onUpdate,
  onToggle,
  onDuplicate,
  onRemove,
  color,
}) {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 space-y-2 fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ background: color || LEG_COLORS[index % LEG_COLORS.length] }}
          />
          <span className="text-xs font-semibold text-slate-200">Leg {index + 1}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded font-medium leading-none ${
            isAtm
              ? 'text-blue-400 bg-blue-400/10'
              : isItm
                ? 'text-green-400 bg-green-400/10'
                : 'text-slate-500 bg-slate-800'
          }`}>
            {isAtm ? 'ATM' : isItm ? 'ITM' : 'OTM'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={leg.visible ? Eye : EyeOff}
            aria-label={leg.visible ? 'Hide leg from chart' : 'Show leg on chart'}
            onClick={() => onToggle(leg.id)}
            className="!text-slate-500 hover:!text-slate-300 !border-transparent"
          />
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            icon={Copy}
            aria-label={`Duplicate leg ${index + 1}`}
            onClick={() => onDuplicate(leg.id)}
            className="!text-slate-500 hover:!text-slate-300 !border-transparent"
          />
          <ConfirmButton
            onConfirm={() => onRemove(leg.id)}
            ariaLabel={`Remove leg ${index + 1}`}
            confirmLabel="Remove"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Type</span>
          <select
            value={leg.type}
            onChange={(e) => onUpdate(leg.id, 'type', e.target.value)}
            aria-label={`Leg ${index + 1} type`}
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Side</span>
          <select
            value={leg.direction}
            onChange={(e) => onUpdate(leg.id, 'direction', e.target.value)}
            aria-label={`Leg ${index + 1} direction`}
            style={{ color: leg.direction === 'long' ? '#4ade80' : '#f87171' }}
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Qty</span>
          <input
            type="number"
            value={leg.quantity}
            onChange={(e) => onUpdate(leg.id, 'quantity', Math.max(1, +e.target.value || 1))}
            aria-label={`Leg ${index + 1} quantity`}
            min="1" step="1"
            className="text-right"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Strike</span>
          <input
            type="number"
            value={leg.strike}
            onChange={(e) => onUpdate(leg.id, 'strike', +e.target.value || 0.01)}
            aria-label={`Leg ${index + 1} strike`}
            step="1" min="0.01"
            className="text-right"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">IV %</span>
          <input
            type="number"
            value={(leg.iv * 100).toFixed(0)}
            onChange={(e) => onUpdate(leg.id, 'iv', (+e.target.value || 0.1) / 100)}
            aria-label={`Leg ${index + 1} implied volatility`}
            step="1" min="1" max="300"
            className="text-right"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500">DTE</span>
          <input
            type="number"
            value={legDte}
            onChange={(e) => onUpdate(leg.id, 'dte', Math.max(0, +e.target.value || 0))}
            aria-label={`Leg ${index + 1} days to expiry`}
            step="1" min="0"
            className="text-right"
          />
        </label>
      </div>

      <div className="grid grid-cols-5 gap-1 text-[11px] pt-1 border-t border-slate-800">
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Premium</div>
          <div className={`font-mono ${leg.premiumOverride ? 'text-slate-200' : 'text-slate-400'}`}>
            ${leg.premium.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Δ</div>
          <div className="font-mono text-blue-400">{greeks.delta.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Γ</div>
          <div className="font-mono text-purple-400">{greeks.gamma.toFixed(4)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Θ</div>
          <div className="font-mono text-pink-400">{greeks.theta.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">ν</div>
          <div className="font-mono text-emerald-400">{greeks.vega.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
