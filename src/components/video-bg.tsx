"use client"

const basePath = process.env.NODE_ENV === "production" ? "/portfolio" : ""

export function VideoBg() {
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      >
        <source src={`${basePath}/video.mp4`} type="video/mp4" />
      </video>
      <div className="fixed inset-0 -z-19 bg-gradient-to-b from-void/70 via-void/75 to-void/90" />
      <div className="fixed inset-0 -z-18 bg-gradient-to-t from-void via-transparent to-void/30" />
    </>
  )
}
