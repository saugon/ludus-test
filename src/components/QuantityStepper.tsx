import { MinusIcon, PlusIcon } from './Icons';

type Props = {
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
};

export function QuantityStepper({ value, max, min = 1, disabled = false, label, onChange }: Props) {
  const step = 'flex size-11 items-center justify-center text-bone hover:bg-ink-3 disabled:opacity-35 disabled:hover:bg-transparent';

  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-md border border-line">
      <button
        type="button"
        className={`${step} rounded-l-md`}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="Restar uno"
      >
        <MinusIcon size={18} />
      </button>
      <output aria-live="polite" className="w-10 text-center font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={`${step} rounded-r-md`}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={value >= max ? `Máximo ${max}` : 'Sumar uno'}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
