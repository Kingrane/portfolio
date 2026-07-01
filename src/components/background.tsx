"use client"

export function Background() {
  return (
    <>
      <div className="fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] animate-blob rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute top-[30%] -right-[10%] h-[45%] w-[45%] animate-blob-2 rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute -bottom-[15%] left-[20%] h-[40%] w-[40%] animate-blob-3 rounded-full bg-cyan-500/4 blur-[120px]" />
      </div>
      <div
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />
    </>
  )
}
