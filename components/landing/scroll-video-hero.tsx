'use client'

import { useEffect, useRef, useState } from 'react'

export function ScrollVideoBackground({
  desktopSrc = '/edificios.mp4',
  mobileSrc = '/edificios-mobile.mp4',
}: {
  desktopSrc?: string
  mobileSrc?: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const targetTimeRef = useRef(0)
  const seekingRef = useRef(false)
  const lastSeekedRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const pick = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      setSrc(isMobile ? mobileSrc : desktopSrc)
    }
    pick()
  }, [desktopSrc, mobileSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Apenas tenemos el primer frame decodificado, sacamos el loader. El
    // resto del buffer sigue bajando en background y el scroll-scrub
    // funciona aun antes de que este 100% bufferizado.
    const onFirstFrame = () => setReady(true)

    const tryFlush = () => {
      if (seekingRef.current) return
      const target = targetTimeRef.current
      if (Math.abs(target - lastSeekedRef.current) < 0.04) return
      seekingRef.current = true
      lastSeekedRef.current = target
      try {
        video.currentTime = target
      } catch {
        seekingRef.current = false
      }
    }

    const onSeeked = () => {
      seekingRef.current = false
      tryFlush()
    }

    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const progress = Math.min(Math.max(window.scrollY / max, 0), 1)
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      targetTimeRef.current = progress * duration
      tryFlush()
    }

    video.addEventListener('loadeddata', onFirstFrame)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadeddata', onScroll)

    if (video.readyState >= 2) onFirstFrame()

    video.load()
    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      video.removeEventListener('loadeddata', onFirstFrame)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadeddata', onScroll)
    }
  }, [src])

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          preload="auto"
          // @ts-expect-error iOS hint
          disablePictureInPicture
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
        </div>
      ) : null}
    </div>
  )
}
