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
  const [bufferProgress, setBufferProgress] = useState(0)
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

    const updateBuffer = () => {
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      let bufferedEnd = 0
      for (let i = 0; i < video.buffered.length; i++) {
        bufferedEnd = Math.max(bufferedEnd, video.buffered.end(i))
      }
      const ratio = Math.min(bufferedEnd / duration, 1)
      setBufferProgress(ratio)
      if (ratio >= 0.995) setReady(true)
    }

    const onCanPlayThrough = () => setReady(true)

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

    video.addEventListener('progress', updateBuffer)
    video.addEventListener('loadedmetadata', updateBuffer)
    video.addEventListener('canplaythrough', onCanPlayThrough)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadeddata', onScroll)

    video.load()
    updateBuffer()
    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      video.removeEventListener('progress', updateBuffer)
      video.removeEventListener('loadedmetadata', updateBuffer)
      video.removeEventListener('canplaythrough', onCanPlayThrough)
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs uppercase tracking-[0.28em] text-white/65">
          <span>Cargando · {Math.round(bufferProgress * 100)}%</span>
          <div className="h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-white/70 transition-[width] duration-200"
              style={{ width: `${Math.round(bufferProgress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
