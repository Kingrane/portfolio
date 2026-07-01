import { projects } from "@/data/projects"
import { ProjectCard } from "@/components/project-card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Background } from "@/components/background"

export default function Home() {
  return (
    <>
      <Background />

      <div className="relative z-10 flex flex-col flex-1">
        <section className="relative flex min-h-[80dvh] items-center justify-center overflow-hidden px-6">
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <span className="eyebrow">Portfolio</span>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-heading sm:text-6xl lg:text-7xl">
                Kingrane
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="mt-4 text-lg leading-relaxed text-muted sm:text-xl">
                Full-stack developer. Экспериментирую с вебом, 3D, и AI.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://github.com/Kingrane"
                  className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface/50 px-6 py-3 text-sm font-medium text-foreground backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-accent-dim hover:text-accent hover:bg-surface-hover active:scale-[0.97]"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                  GitHub
                </a>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <main className="mx-auto w-full max-w-6xl px-6 py-24 sm:px-8">
          <ScrollReveal>
            <div className="mb-14 text-center sm:text-left">
              <span className="eyebrow">Projects</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
                Что я накодил
              </h2>
              <p className="mt-2 text-muted">10 проектов — от 3D-игр до веб-DAW</p>
            </div>
          </ScrollReveal>

          <div className="grid gap-5 sm:grid-cols-2">
            {projects.map((project, i) => (
              <ProjectCard key={project.title} project={project} index={i} />
            ))}
          </div>
        </main>

        <footer className="border-t border-border/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-8">
            <p>© 2026 Kingrane</p>
            <p className="text-xs">built with Next.js · hosted on GitHub Pages</p>
          </div>
        </footer>
      </div>
    </>
  )
}
