type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS_MAP: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-4'
};

interface SpinnerProps {
  label?: string;
  size?: SpinnerSize;
}

export function Spinner({ label = 'Loading', size = 'md' }: SpinnerProps) {
  return (
    <div aria-live="polite" className="inline-flex items-center gap-2 text-slate-700" role="status">
      <span
        className={`${SIZE_CLASS_MAP[size]} spinner-ring inline-block rounded-full border-slate-300 border-t-slate-900`}
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
