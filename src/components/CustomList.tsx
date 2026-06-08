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
  placeholderTitle?: string;
  placeholderSubtitle?: string;
  placeholderIcon?: string;
  disabled?: boolean;
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
  placeholderTitle = 'Choose an option...',
  placeholderSubtitle = '',
  placeholderIcon = '▣',
  disabled = false,
  className = '',
}: CustomListProps<T>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedOption = options.find((option) => getId(option) === selectedId);
  const isDisabled = disabled || options.length === 0;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open || !(event.target instanceof Node) || details.contains(event.target)) return;

      details.removeAttribute('open');
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const title = selectedOption ? getTitle(selectedOption) : placeholderTitle;
  const subtitle = selectedOption ? getSubtitle(selectedOption) : placeholderSubtitle;
  const icon = selectedOption ? getIcon(selectedOption) : placeholderIcon;

  return (
    <div className={`relative flex min-w-0 flex-col gap-2 font-bold text-neutral-700 dark:text-neutral-100 ${className}`}>
      <span>{label}</span>
      <details ref={detailsRef} className="group/list" onToggle={(event) => { if (isDisabled) event.currentTarget.removeAttribute('open'); }}>
        <summary
          className={`group flex min-h-14 w-full list-none items-center gap-3 rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 px-3 py-2 text-left shadow-inner shadow-amber-900/5 outline-none transition focus:border-neutral-500 focus:ring-4 focus:ring-neutral-500/20 [&::-webkit-details-marker]:hidden dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-800 dark:shadow-black/20 dark:focus:border-neutral-400 dark:focus:ring-neutral-400/20 ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-lg hover:shadow-neutral-900/10 dark:hover:border-neutral-600 dark:hover:shadow-black/30'}`}
          aria-disabled={isDisabled}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-2xl ring-1 ring-neutral-200 transition group-hover:scale-105 dark:bg-neutral-800 dark:ring-neutral-700">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-black text-neutral-950 dark:text-neutral-50">{title}</span>
            <span className="block truncate text-sm font-bold text-neutral-600 dark:text-neutral-300">{subtitle}</span>
          </span>
          <span className="shrink-0 text-neutral-600 transition group-open/list:rotate-180 dark:text-neutral-300" aria-hidden="true">
            ▾
          </span>
        </summary>

        {!isDisabled && (
          <div
            className="absolute right-0 top-full z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-3xl border border-neutral-200 bg-white/95 p-2 shadow-2xl shadow-neutral-900/20 backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95 dark:shadow-black/30"
            role="listbox"
            aria-label={ariaLabel}
          >
            {options.map((option) => {
            const id = getId(option);
            const isSelected = id === selectedId;

            return (
              <button
                key={id}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800 ${isSelected ? 'bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700' : ''}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={(event) => {
                  onChange(id);
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-xl ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                  {getIcon(option)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-neutral-950 dark:text-neutral-50">{getTitle(option)}</span>
                  <span className="block truncate text-sm font-bold text-neutral-500 dark:text-neutral-400">{getSubtitle(option)}</span>
                </span>
              </button>
            );
            })}
          </div>
        )}
      </details>
    </div>
  );
}
