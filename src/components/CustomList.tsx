import { useEffect, useRef } from 'react';

type CustomListProps<T> = {
  label: string;
  ariaLabel: string;
  options: T[];
  selectedId: string;
  onChange: (id: string) => void;
  getId: (option: T) => string;
  getTitle: (option: T) => string;
  getSubtitle: (option: T) => string;
  getIcon: (option: T) => string;
  className?: string;
};

export function CustomList<T>({
  label,
  ariaLabel,
  options,
  selectedId,
  onChange,
  getId,
  getTitle,
  getSubtitle,
  getIcon,
  className = '',
}: CustomListProps<T>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedOption = options.find((option) => getId(option) === selectedId) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || !(event.target instanceof Node) || details.contains(event.target)) return;

      details.removeAttribute('open');
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (!selectedOption) return null;

  return (
    <div className={`relative flex min-w-0 flex-col gap-2 font-bold text-slate-700 ${className}`}>
      <span>{label}</span>
      <details ref={detailsRef} className="group/list">
        <summary className="group flex min-h-14 w-full cursor-pointer list-none items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 px-3 py-2 text-left shadow-inner shadow-amber-900/5 outline-none transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/10 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 [&::-webkit-details-marker]:hidden">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-2xl ring-1 ring-amber-200 transition group-hover:scale-105">
            {getIcon(selectedOption)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black text-slate-950">{getTitle(selectedOption)}</span>
            <span className="block truncate text-sm font-bold text-amber-800">{getSubtitle(selectedOption)}</span>
          </span>
          <span className="shrink-0 text-amber-700 transition group-open/list:rotate-180" aria-hidden="true">
            ▾
          </span>
        </summary>

        <div
          className="absolute right-0 top-full z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-3xl border border-amber-200 bg-white/95 p-2 shadow-2xl shadow-amber-900/20 backdrop-blur"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const id = getId(option);
            const isSelected = id === selectedId;

            return (
              <button
                key={id}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-amber-50 ${isSelected ? 'bg-amber-100 ring-1 ring-amber-200' : ''}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(event) => {
                  onChange(id);
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xl ring-1 ring-amber-200">
                  {getIcon(option)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-slate-950">{getTitle(option)}</span>
                  <span className="block truncate text-sm font-bold text-slate-500">{getSubtitle(option)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
