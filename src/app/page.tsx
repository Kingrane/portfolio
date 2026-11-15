import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/sections/hero";
import { Stack } from "@/components/sections/stack";
import { Projects } from "@/components/sections/projects";
import { Handmade } from "@/components/sections/handmade";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { Cursor } from "@/components/ui/cursor";
import { SceneRoot } from "@/components/webgl/scene-root";

/**
 * Сборка страницы. Никакой логики — только порядок слоёв и секций.
 *
 * z-index:
 *   0  — WebGL-сцена, fixed, pointer-events: none
 *   10 — контент (обычный HTML: SEO, клавиатура, скринридеры)
 *   40 — шапка
 *   70 — курсор
 */
export default function Home() {
  return (
    <>
      <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 bg-void px-4 py-3 text-ink focus:translate-y-0">Перейти к содержимому</a>
      <SceneRoot />
      <SmoothScroll />
      <Cursor />
      <SiteHeader />

      <div className="relative z-[var(--z-content)] flex min-h-full flex-col">
        <main id="main-content" className="flex-1" tabIndex={-1}>
          <Hero />
          <Stack />
          <Projects />
          <Handmade />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
