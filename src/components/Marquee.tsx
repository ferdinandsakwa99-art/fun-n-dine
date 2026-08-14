import { useEffect, useRef, type ReactNode } from 'react'

export function Marquee({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const row = rowRef.current
    if (!viewport || !row) return

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduced || window.innerWidth >= 768) return

    let resumeTimer: number | undefined

    const pause = () => {
      row.classList.add('is-paused')
      if (resumeTimer) window.clearTimeout(resumeTimer)
    }

    const resume = () => {
      if (resumeTimer) window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => {
        row.classList.remove('is-paused')
      }, 1500)
    }

    viewport.addEventListener('mouseenter', pause)
    viewport.addEventListener('mouseleave', resume)
    viewport.addEventListener('touchstart', pause)
    viewport.addEventListener('touchend', resume)
    viewport.addEventListener('scroll', pause)
    viewport.addEventListener('wheel', pause)
    viewport.addEventListener('wheel', resume, { passive: true })

    return () => {
      if (resumeTimer) window.clearTimeout(resumeTimer)
      viewport.removeEventListener('mouseenter', pause)
      viewport.removeEventListener('mouseleave', resume)
      viewport.removeEventListener('touchstart', pause)
      viewport.removeEventListener('touchend', resume)
      viewport.removeEventListener('scroll', pause)
      viewport.removeEventListener('wheel', pause)
      viewport.removeEventListener('wheel', resume)
    }
  }, [])

  return (
    <div ref={viewportRef} className="rec-viewport mt-4 pb-2">
      <div ref={rowRef} className="rec-row">
        <div className="rec-copy">{children}</div>
        <div className="rec-copy">{children}</div>
      </div>
    </div>
  )
}
