import { cn } from "@/lib/cn";

/**
 * Sections share one background; layout never draws a world boundary.
 */
export function SectionShell({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  /** Номер секции: "01" */
  index?: string;
  /** Заголовок-лейбл: "PROJECTS · 12" */
  label?: string;
  /** Правая часть строки: подпись, счётчик, что угодно */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Убрать внутренние отступы (когда внутри полноширинная сцена) */
  bleed?: boolean;
}) {
  return (
    <section id={id} className={cn("relative", className)}>
      <div className="relative mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter)]">
        <div className={bleed ? undefined : "py-20 sm:py-28"}>{children}</div>
      </div>
    </section>
  );
}
