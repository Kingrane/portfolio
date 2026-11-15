import { cn } from "@/lib/cn";

/**
 * Обёртка секции в стиле Devault: сетка с видимыми волосяными линиями по
 * краям контейнера и «+» на пересечениях. Всё оформление — здесь, чтобы
 * секции занимались только контентом.
 */
export function SectionShell({
  id,
  index,
  label,
  meta,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  /** Номер секции: "01" */
  index: string;
  /** Заголовок-лейбл: "PROJECTS · 12" */
  label: string;
  /** Правая часть строки: подпись, счётчик, что угодно */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Убрать внутренние отступы (когда внутри полноширинная сцена) */
  bleed?: boolean;
}) {
  return (
    <section id={id} className={cn("relative", className)}>
      {/* Вертикальные линии контейнера, тянутся на всю высоту секции */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[var(--container-max)] -translate-x-1/2 px-[var(--gutter)]"
      >
        <span className="absolute inset-y-0 left-[var(--gutter)] w-px bg-line" />
        <span className="absolute inset-y-0 right-[var(--gutter)] w-px bg-line" />
      </div>

      <div className="relative mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)]">
        <div className="relative flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line py-4">
          <div className="flex items-baseline gap-3">
            <span className="hud text-ink-faint">[ {index} ]</span>
            <h2 className="hud text-ink">{label}</h2>
          </div>
          {meta ? <div className="hud hidden sm:block">{meta}</div> : null}

          {/* «+» на пересечении вертикальной и горизонтальной линии */}
          <Plus className="-bottom-[6.5px] -left-[7px]" />
          <Plus className="-bottom-[6.5px] -right-[7px]" />
        </div>

        <div className={bleed ? undefined : "py-16 sm:py-24"}>{children}</div>
      </div>
    </section>
  );
}

export function Plus({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute select-none font-mono text-[11px] leading-none text-line-strong",
        className,
      )}
    >
      +
    </span>
  );
}
