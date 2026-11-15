import { SectionShell } from "@/components/ui/section-shell";
import { Marquee } from "@/components/ui/marquee";
import { Reveal, SplitText } from "@/components/ui/reveal";
import { languages, technologies } from "@/content/stack";

/**
 * Секция стека: тикеры в обе стороны + два списка с индексами.
 * В Фазе 2 под ней появится созвездие из узлов-технологий.
 */
export function Stack() {
  const total = languages.length + technologies.length;

  return (
    <SectionShell
      id="stack"
      index="01"
      label={`stack · ${total}`}
      meta="ticker · hover to freeze"
      bleed
    >
      <div className="border-b border-line">
        <Marquee items={languages} />
        <div className="border-t border-line">
          <Marquee items={technologies} reverse />
        </div>
      </div>

      <div className="px-[var(--gutter)] py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <h2 className="max-w-lg font-display text-[clamp(1.9rem,4.4vw,3.4rem)] font-light leading-[0.98] tracking-[-0.03em]">
              <SplitText text="Чем я это всё" />
              <br />
              <span className="text-ink-faint">
                <SplitText text="делаю" delay={0.12} />
              </span>
            </h2>
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-dim">
                Языки, в которых чувствую себя дома, и инструменты, которыми собираю.
                Половина проектов родилась из «а что если», а не из брифа.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <StackList title="languages" items={languages.map((l) => l.name)} accent="iris" />
            <StackList
              title="tools & ecosystem"
              items={technologies.map((t) => t.name)}
              accent="amber"
            />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function StackList({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "iris" | "amber";
}) {
  return (
    <div>
      <p className="hud mb-3 flex items-center gap-2 border-b border-line pb-2">
        <span
          className={accent === "iris" ? "h-1 w-1 bg-iris" : "h-1 w-1 bg-amber"}
          aria-hidden
        />
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item}
            className="group flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-dim transition-colors duration-300 hover:text-ink"
          >
            <span className="text-[9px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1">{item}</span>
            <span className="h-px w-3 bg-line-strong opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
