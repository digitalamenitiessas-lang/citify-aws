'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, PerspectiveCamera, RoundedBox, useGLTF } from '@react-three/drei'
import { Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { ArrowRight, BarChart3, Building2, Facebook, Instagram, Linkedin, Mail, Shield, Tag, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Promotion } from '@/lib/types'
import { landingFeatures, landingModelAsset, landingScenes, landingStats, type LandingFeature, type LandingSceneDefinition } from '@/lib/landing-scenes'
import { ScrollVideoBackground } from '@/components/landing/scroll-video-hero'

const SCENE_HEIGHT = 110
const CONTACT_EMAIL = 'micitify@gmail.com'

const CONTACT_LINKS = {
  business: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero sumar mi comercio a CITIFY')}`,
  building: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero llevar CITIFY a mi edificio')}`,
  general: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero sumarme a CITIFY')}`,
}

const SOCIAL_LINKS = [
  { label: 'Instagram', href: '#', icon: Instagram },
  { label: 'Facebook', href: '#', icon: Facebook },
  { label: 'LinkedIn', href: '#', icon: Linkedin },
]

function iconForFeature(icon: LandingFeature['icon']) {
  switch (icon) {
    case 'building':
      return Building2
    case 'barChart':
      return BarChart3
    case 'shield':
      return Shield
    case 'users':
      return Users
    case 'zap':
      return Zap
    default:
      return Tag
  }
}

function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return prefersReducedMotion
}

function useViewportMode() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return isMobile
}

function useReducedDetailMode(isMobile: boolean, prefersReducedMotion: boolean) {
  const [reducedDetail, setReducedDetail] = useState(isMobile || prefersReducedMotion)

  useEffect(() => {
    setReducedDetail(isMobile || prefersReducedMotion)

    if (typeof navigator === 'undefined') {
      return
    }

    const hardwareConcurrency = navigator.hardwareConcurrency ?? 8
    if (hardwareConcurrency <= 4) {
      setReducedDetail(true)
    }
  }, [isMobile, prefersReducedMotion])

  return reducedDetail
}

function useLandingScrollProgress(sceneCount: number) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      setProgress(Math.min(Math.max(scrollTop / maxScroll, 0), 1))
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [sceneCount])

  const segmentProgress = progress * Math.max(sceneCount - 1, 1)
  const sceneIndex = Math.min(Math.floor(segmentProgress + 0.0001), sceneCount - 1)
  const localProgress = Math.min(Math.max(segmentProgress - sceneIndex, 0), 1)

  return { progress, sceneIndex, localProgress }
}

function interpolateVector3(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, progress: number) {
  return {
    x: MathUtils.lerp(from.x, to.x, progress),
    y: MathUtils.lerp(from.y, to.y, progress),
    z: MathUtils.lerp(from.z, to.z, progress),
  }
}

function interpolateVectorPath(path: LandingSceneDefinition['desktopCameraPath'], progress: number) {
  if (path.length <= 1) {
    return path[0]
  }

  const clamped = Math.min(Math.max(progress, 0), 1)
  const scaled = clamped * (path.length - 1)
  const index = Math.min(Math.floor(scaled), path.length - 2)
  const local = scaled - index

  return {
    x: MathUtils.lerp(path[index].x, path[index + 1].x, local),
    y: MathUtils.lerp(path[index].y, path[index + 1].y, local),
    z: MathUtils.lerp(path[index].z, path[index + 1].z, local),
  }
}

function resolveSceneCameraState(scene: LandingSceneDefinition, isMobile: boolean, progress: number) {
  const cameraPath = isMobile ? scene.mobileCameraPath : scene.desktopCameraPath
  const targetPath = isMobile ? scene.mobileCameraTargetPath : scene.desktopCameraTargetPath

  return {
    position: interpolateVectorPath(cameraPath, progress),
    target: interpolateVectorPath(targetPath, progress),
  }
}

function Artwork({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.45, 0.95, 0.06]} radius={0.05} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#d9e4ef" roughness={0.42} metalness={0.16} />
      </RoundedBox>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.18, 0.72]} />
        <meshStandardMaterial color="#13212d" emissive="#0f2335" emissiveIntensity={0.22} roughness={0.28} metalness={0.08} />
      </mesh>
      <mesh position={[-0.18, 0.02, 0.045]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshStandardMaterial color="#4ec8de" emissive="#4ec8de" emissiveIntensity={0.32} roughness={0.24} />
      </mesh>
      <mesh position={[0.26, -0.06, 0.045]}>
        <planeGeometry args={[0.36, 0.28]} />
        <meshStandardMaterial color="#cdd8e3" roughness={0.2} metalness={0.12} />
      </mesh>
    </group>
  )
}

function LightStrip({
  position,
  size,
  color = '#57d2ee',
  intensity = 0.4,
  rotation = [0, 0, 0] as [number, number, number],
  reducedMotion = false,
  pulseOffset = 0,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color?: string
  intensity?: number
  rotation?: [number, number, number]
  reducedMotion?: boolean
  pulseOffset?: number
}) {
  const stripRef = useRef<Mesh | null>(null)

  useFrame(({ clock }) => {
    if (!stripRef.current) {
      return
    }

    const material = stripRef.current.material as MeshStandardMaterial
    const t = clock.getElapsedTime() + pulseOffset
    const nextIntensity = reducedMotion
      ? intensity * 0.78
      : intensity * (0.78 + (Math.sin(t * 1.2) + 1) * 0.14)

    material.emissiveIntensity = nextIntensity
  })

  return (
    <mesh ref={stripRef} position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.18} metalness={0.1} />
    </mesh>
  )
}

function AnimatedScreenSurface({
  width,
  height,
  reducedMotion,
  lineColor = '#66e6ff',
}: {
  width: number
  height: number
  reducedMotion: boolean
  lineColor?: string
}) {
  const lineRefs = useRef<Array<Mesh | null>>([])
  const accentRefs = useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    lineRefs.current.forEach((line, index) => {
      if (!line) {
        return
      }

      const drift = reducedMotion ? 0 : Math.sin(t * (0.45 + index * 0.08) + index) * width * 0.08
      line.position.x = drift

      const material = line.material as MeshStandardMaterial
      material.emissiveIntensity = reducedMotion ? 0.34 : 0.28 + (Math.sin(t * (0.9 + index * 0.1) + index) + 1) * 0.16
      material.opacity = reducedMotion ? 0.88 : 0.72 + (Math.sin(t * (0.6 + index * 0.06) + index * 1.7) + 1) * 0.09
    })

    accentRefs.current.forEach((accent, index) => {
      if (!accent) {
        return
      }

      accent.position.x = reducedMotion ? accent.position.x : Math.sin(t * (0.75 + index * 0.12) + index) * width * 0.12
      const material = accent.material as MeshStandardMaterial
      material.emissiveIntensity = reducedMotion ? 0.44 : 0.4 + (Math.sin(t * (1.1 + index * 0.16) + index * 0.8) + 1) * 0.18
    })
  })

  return (
    <group position={[0, 0, 0.002]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#0f2335" emissive="#16384f" emissiveIntensity={0.2} roughness={0.1} metalness={0.08} />
      </mesh>
      {[
        { y: height * 0.2, w: width * 0.32 },
        { y: height * 0.06, w: width * 0.48 },
        { y: -height * 0.08, w: width * 0.26 },
        { y: -height * 0.2, w: width * 0.4 },
      ].map((line, index) => (
        <mesh
          key={index}
          ref={(node) => {
            lineRefs.current[index] = node
          }}
          position={[0, line.y, 0.002]}
        >
          <planeGeometry args={[line.w, height * 0.04]} />
          <meshStandardMaterial
            color={lineColor}
            emissive={lineColor}
            emissiveIntensity={0.42}
            roughness={0.08}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
      {[
        { y: height * 0.28, w: width * 0.08, h: height * 0.12 },
        { y: -height * 0.26, w: width * 0.12, h: height * 0.08 },
      ].map((accent, index) => (
        <mesh
          key={`accent-${index}`}
          ref={(node) => {
            accentRefs.current[index] = node
          }}
          position={[0, accent.y, 0.003]}
        >
          <planeGeometry args={[accent.w, accent.h]} />
          <meshStandardMaterial color="#9dd7ff" emissive="#9dd7ff" emissiveIntensity={0.48} roughness={0.08} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  )
}

function SmartPanel({
  position,
  rotation = [0, 0, 0] as [number, number, number],
  width = 0.9,
  height = 0.56,
  reducedMotion = false,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  reducedMotion?: boolean
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width, height, 0.05]} radius={0.03} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#09131d" roughness={0.18} metalness={0.22} />
      </RoundedBox>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[width * 0.88, height * 0.8]} />
        <meshStandardMaterial color="#102538" emissive="#163c53" emissiveIntensity={0.22} roughness={0.12} metalness={0.08} />
      </mesh>
      <AnimatedScreenSurface width={width * 0.88} height={height * 0.8} reducedMotion={reducedMotion} />
    </group>
  )
}

function SmartSpeakerDock({ position, reducedMotion = false }: { position: [number, number, number]; reducedMotion?: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.3, 0.1, 0.18]} radius={0.04} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#adb9c4" roughness={0.22} metalness={0.4} />
      </RoundedBox>
      <LightStrip position={[0, 0.03, 0]} size={[0.14, 0.012, 0.06]} intensity={0.56} reducedMotion={reducedMotion} />
    </group>
  )
}

function CurtainPair({ position, width = 2.2 }: { position: [number, number, number]; width?: number }) {
  return (
    <group position={position}>
      <mesh position={[-width * 0.26, 0, 0]}>
        <boxGeometry args={[width * 0.42, 2.35, 0.06]} />
        <meshStandardMaterial color="#cad8e3" roughness={0.72} transparent opacity={0.54} metalness={0.04} />
      </mesh>
      <mesh position={[width * 0.26, 0, 0]}>
        <boxGeometry args={[width * 0.42, 2.35, 0.06]} />
        <meshStandardMaterial color="#cad8e3" roughness={0.72} transparent opacity={0.54} metalness={0.04} />
      </mesh>
    </group>
  )
}

function WindowWall({ position, width, height }: { position: [number, number, number]; width: number; height: number }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, height]} />
        <meshStandardMaterial color="#5f7688" roughness={0.22} metalness={0.46} />
      </mesh>
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[width * 0.9, 0.04, height * 0.82]} />
        <meshStandardMaterial color="#bcd6ea" transparent opacity={0.18} metalness={0.18} roughness={0.04} />
      </mesh>
    </group>
  )
}

function PendantLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1, 12]} />
        <meshStandardMaterial color="#b2c3d1" metalness={0.5} roughness={0.18} />
      </mesh>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.14, 18]} />
        <meshStandardMaterial color="#deebf5" emissive="#77d8f4" emissiveIntensity={0.34} roughness={0.18} metalness={0.18} />
      </mesh>
    </group>
  )
}

function Sofa({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.7, 0.42, 1.05]} radius={0.08} smoothness={4} position={[0, 0.24, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#6f7b87" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[2.7, 0.85, 0.28]} radius={0.08} smoothness={4} position={[0, 0.62, -0.38]} castShadow receiveShadow>
        <meshStandardMaterial color="#7b8792" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[0.26, 0.72, 1.02]} radius={0.08} smoothness={4} position={[-1.22, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#66727d" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[0.26, 0.72, 1.02]} radius={0.08} smoothness={4} position={[1.22, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#66727d" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.18, 0.62]} radius={0.06} smoothness={4} position={[-0.72, 0.58, 0.12]} castShadow receiveShadow>
        <meshStandardMaterial color="#d5dde4" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.2, 0.52]} radius={0.06} smoothness={4} position={[0.12, 0.56, 0.18]} castShadow receiveShadow>
        <meshStandardMaterial color="#49bcd7" roughness={0.54} emissive="#49bcd7" emissiveIntensity={0.08} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.16, 0.48]} radius={0.05} smoothness={4} position={[0.78, 0.55, -0.02]} castShadow receiveShadow>
        <meshStandardMaterial color="#a5bacd" roughness={0.58} />
      </RoundedBox>
    </group>
  )
}

function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.45, 0.12, 0.82]} radius={0.05} smoothness={4} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#a4b3c0" roughness={0.16} metalness={0.42} />
      </RoundedBox>
      {[
        [-0.56, 0.18, -0.26],
        [0.56, 0.18, -0.26],
        [-0.56, 0.18, 0.26],
        [0.56, 0.18, 0.26],
      ].map((leg, index) => (
        <mesh key={index} position={leg as [number, number, number]} castShadow receiveShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.38, 12]} />
          <meshStandardMaterial color="#566674" roughness={0.22} metalness={0.52} />
        </mesh>
      ))}
      <mesh position={[0.22, 0.49, -0.06]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 18]} />
        <meshStandardMaterial color="#cce7f4" roughness={0.08} metalness={0.1} transparent opacity={0.88} />
      </mesh>
    </group>
  )
}

function MediaConsole({ position, reducedMotion }: { position: [number, number, number]; reducedMotion: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[2.15, 0.34, 0.46]} radius={0.05} smoothness={4} position={[0, 0.26, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3e4a56" roughness={0.18} metalness={0.44} />
      </RoundedBox>
      <mesh position={[0, 1.02, -0.12]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.06, 0.08]} />
        <meshStandardMaterial color="#0f1822" roughness={0.08} metalness={0.2} emissive="#153148" emissiveIntensity={0.14} />
      </mesh>
      <group position={[0, 1.02, -0.075]}>
        <AnimatedScreenSurface width={1.72} height={0.88} reducedMotion={reducedMotion} />
      </group>
      <mesh position={[-0.6, 0.18, 0.26]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.22, 0.04]} />
        <meshStandardMaterial color="#95d8f3" emissive="#6fd6ee" emissiveIntensity={0.36} roughness={0.22} />
      </mesh>
      <LightStrip position={[0, 0.06, 0.25]} size={[1.72, 0.02, 0.018]} intensity={0.42} reducedMotion={reducedMotion} />
    </group>
  )
}

function KitchenIsland({ position, mobile, reducedMotion }: { position: [number, number, number]; mobile: boolean; reducedMotion: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[2.4, 0.9, 1.05]} radius={0.05} smoothness={4} position={[0, 0.45, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#586773" roughness={0.22} metalness={0.34} />
      </RoundedBox>
      <RoundedBox args={[2.56, 0.08, 1.16]} radius={0.04} smoothness={4} position={[0, 0.94, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d7e4ec" roughness={0.12} metalness={0.08} />
      </RoundedBox>
      <LightStrip position={[0, 0.12, 0.53]} size={[2.18, 0.028, 0.02]} intensity={0.42} reducedMotion={reducedMotion} pulseOffset={0.4} />
      {!mobile ? (
        <>
          <mesh position={[-0.56, 0.92, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.04, 0.26]} />
            <meshStandardMaterial color="#0d151e" roughness={0.08} metalness={0.32} />
          </mesh>
          <mesh position={[0.6, 0.92, -0.1]} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.18, 16]} />
            <meshStandardMaterial color="#a4bac7" roughness={0.18} metalness={0.3} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function BarStool({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
        <meshStandardMaterial color="#8ea0ae" roughness={0.26} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.44, 12]} />
        <meshStandardMaterial color="#667887" metalness={0.44} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.2, 0.05, 18]} />
        <meshStandardMaterial color="#556370" roughness={0.2} metalness={0.38} />
      </mesh>
    </group>
  )
}

function DiningTable({ position, mobile, reducedMotion }: { position: [number, number, number]; mobile: boolean; reducedMotion: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.82, 0.08, 0.92]} radius={0.04} smoothness={4} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#bdc9d3" roughness={0.16} metalness={0.34} />
      </RoundedBox>
      {[
        [-0.72, 0.37, -0.3],
        [0.72, 0.37, -0.3],
        [-0.72, 0.37, 0.3],
        [0.72, 0.37, 0.3],
      ].map((leg, index) => (
        <mesh key={index} position={leg as [number, number, number]} castShadow receiveShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.74, 12]} />
          <meshStandardMaterial color="#5a6a76" roughness={0.2} metalness={0.46} />
        </mesh>
      ))}
      <LightStrip position={[0, 0.78, 0.4]} size={[1.34, 0.018, 0.02]} intensity={0.3} reducedMotion={reducedMotion} pulseOffset={0.9} />
      {!mobile ? (
        <>
          <mesh position={[0, 0.8, 0.08]} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.16, 16]} />
            <meshStandardMaterial color="#90d3f0" emissive="#70d8f6" emissiveIntensity={0.34} roughness={0.22} />
          </mesh>
          <mesh position={[0.34, 0.81, -0.14]} castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.05, 0.24]} />
            <meshStandardMaterial color="#d4e2ec" roughness={0.18} metalness={0.1} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function DiningChair({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.48, 0.08, 0.48]} radius={0.03} smoothness={4} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#8fa1af" roughness={0.36} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.48, 0.52, 0.08]} radius={0.03} smoothness={4} position={[0, 0.82, -0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#6f818e" roughness={0.42} metalness={0.14} />
      </RoundedBox>
      {[
        [-0.16, 0.24, -0.16],
        [0.16, 0.24, -0.16],
        [-0.16, 0.24, 0.16],
        [0.16, 0.24, 0.16],
      ].map((leg, index) => (
        <mesh key={index} position={leg as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.46, 0.05]} />
          <meshStandardMaterial color="#596976" roughness={0.22} metalness={0.42} />
        </mesh>
      ))}
    </group>
  )
}

function DoorFrame({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-0.46, 1.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 2.16, 0.12]} />
        <meshStandardMaterial color="#d8e2ea" roughness={0.28} metalness={0.16} />
      </mesh>
      <mesh position={[0.46, 1.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 2.16, 0.12]} />
        <meshStandardMaterial color="#d8e2ea" roughness={0.28} metalness={0.16} />
      </mesh>
      <mesh position={[0, 2.13, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.02, 0.1, 0.12]} />
        <meshStandardMaterial color="#d8e2ea" roughness={0.28} metalness={0.16} />
      </mesh>
    </group>
  )
}

function DeskSetup({ position, mobile, reducedMotion }: { position: [number, number, number]; mobile: boolean; reducedMotion: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.7, 0.08, 0.72]} radius={0.03} smoothness={4} position={[0, 0.76, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#5a6875" roughness={0.22} metalness={0.36} />
      </RoundedBox>
      {[
        [-0.74, 0.37, -0.28],
        [0.74, 0.37, -0.28],
        [-0.74, 0.37, 0.28],
        [0.74, 0.37, 0.28],
      ].map((leg, index) => (
        <mesh key={index} position={leg as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
          <meshStandardMaterial color="#60717f" roughness={0.2} metalness={0.48} />
        </mesh>
      ))}
      <mesh position={[0, 1.14, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.5, 0.06]} />
        <meshStandardMaterial color="#07131d" roughness={0.08} metalness={0.18} emissive="#17364d" emissiveIntensity={0.2} />
      </mesh>
      <group position={[0, 1.14, -0.185]}>
        <AnimatedScreenSurface width={0.72} height={0.38} reducedMotion={reducedMotion} lineColor="#74e5ff" />
      </group>
      <LightStrip position={[0, 0.82, 0.26]} size={[1.2, 0.016, 0.02]} intensity={0.36} reducedMotion={reducedMotion} pulseOffset={1.1} />
    </group>
  )
}

function DeskChair({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.52, 0.08, 0.48]} radius={0.03} smoothness={4} position={[0, 0.54, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#7e909d" roughness={0.44} metalness={0.1} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.54, 0.08]} radius={0.03} smoothness={4} position={[0, 0.88, 0.2]} rotation={[-0.08, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#70828f" roughness={0.46} metalness={0.1} />
      </RoundedBox>
      <mesh position={[0, 0.7, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#5f707c" roughness={0.24} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.42, 12]} />
        <meshStandardMaterial color="#5f707c" roughness={0.24} metalness={0.42} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.26, 0.14, 0.05, 18]} />
        <meshStandardMaterial color="#50606b" roughness={0.22} metalness={0.4} />
      </mesh>
    </group>
  )
}

function Bookshelf({ position, mobile }: { position: [number, number, number]; mobile: boolean }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.18, 2.2, 0.34]} radius={0.03} smoothness={4} position={[0, 1.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3d4a57" roughness={0.2} metalness={0.4} />
      </RoundedBox>
      {[0.42, 0.96, 1.5, 2.02].map((y, index) => (
        <mesh key={index} position={[0, y, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[1.06, 0.04, 0.28]} />
          <meshStandardMaterial color="#566775" roughness={0.22} metalness={0.28} />
        </mesh>
      ))}
      {!mobile
        ? [
            { position: [-0.28, 0.56, 0.12], color: '#bbcbda', width: 0.18, height: 0.28 },
            { position: [0.04, 0.56, 0.12], color: '#59cce8', width: 0.16, height: 0.32 },
            { position: [0.28, 1.1, 0.12], color: '#91a6b9', width: 0.18, height: 0.24 },
            { position: [-0.18, 1.62, 0.12], color: '#d8e4ee', width: 0.34, height: 0.18 },
          ].map((item, index) => (
            <mesh key={index} position={item.position as [number, number, number]} castShadow receiveShadow>
              <boxGeometry args={[item.width, item.height, 0.12]} />
              <meshStandardMaterial color={item.color} roughness={0.42} metalness={item.color === '#59cce8' ? 0.12 : 0.04} emissive={item.color === '#59cce8' ? '#59cce8' : undefined} emissiveIntensity={item.color === '#59cce8' ? 0.18 : 0} />
            </mesh>
          ))
        : null}
    </group>
  )
}

function HallRunner({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1.36, 4.4]} />
      <meshStandardMaterial color="#7d8995" roughness={0.94} />
    </mesh>
  )
}

function ApartmentShell({ reducedDetail, reducedMotion }: { reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 20]} />
        <meshStandardMaterial color="#d6e0e8" roughness={0.92} />
      </mesh>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.8, 5.6]} />
        <meshStandardMaterial color="#728291" roughness={0.24} metalness={0.18} />
      </mesh>
      <mesh position={[-5.2, 0.021, 0.25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.8, 4.9]} />
        <meshStandardMaterial color="#dbe4ea" roughness={0.58} />
      </mesh>
      <mesh position={[2.5, 0.021, -4.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 4.6]} />
        <meshStandardMaterial color="#e3eaef" roughness={0.64} />
      </mesh>
      <mesh position={[6.2, 0.021, -1.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.5, 5.1]} />
        <meshStandardMaterial color="#d8e1e8" roughness={0.58} />
      </mesh>

      {[[-3.86, 0.09, 0], [3.86, 0.09, 0], [0, 0.09, -2.76], [0, 0.09, 2.76]].map((strip, index) => (
          <mesh key={index} position={strip as [number, number, number]} receiveShadow>
            <boxGeometry args={[index < 2 ? 0.12 : 7.84, 0.16, index < 2 ? 5.64 : 0.12]} />
            <meshStandardMaterial color="#5a6976" roughness={0.26} metalness={0.22} />
          </mesh>
      ))}

      {[[-8.06, 0.09, 0.25, 0.12, 4.96], [-2.34, 0.09, 0.25, 0.12, 4.96], [-5.2, 0.09, -2.2, 5.84, 0.12], [-5.2, 0.09, 2.7, 5.84, 0.12]].map(
        (wall, index) => (
          <mesh key={index} position={[wall[0], wall[1], wall[2]] as [number, number, number]} receiveShadow>
            <boxGeometry args={[wall[3], 0.16, wall[4]]} />
            <meshStandardMaterial color="#53626f" roughness={0.24} metalness={0.18} />
          </mesh>
        ),
      )}

      {[[-1.94, 0.09, -4.1, 0.12, 4.7], [3.1, 0.09, -4.1, 0.12, 4.7], [6.2, 0.09, -4.16, 4.62, 0.12], [6.2, 0.09, 0.96, 4.62, 0.12]].map(
        (wall, index) => (
          <mesh key={index} position={[wall[0], wall[1], wall[2]] as [number, number, number]} receiveShadow>
            <boxGeometry args={[wall[3], 0.16, wall[4]]} />
            <meshStandardMaterial color="#566774" roughness={0.24} metalness={0.18} />
          </mesh>
        ),
      )}

      {[
        { position: [-3.44, 1.44, -2.76], size: [0.18, 2.88, 2.24] },
        { position: [-3.44, 1.44, 1.88], size: [0.18, 2.88, 1.64] },
        { position: [1.94, 1.44, -4.1], size: [0.18, 2.88, 1.08] },
        { position: [3.1, 1.44, -1.48], size: [0.18, 2.88, 2.08] },
        { position: [3.1, 1.44, -5.46], size: [0.18, 2.88, 0.96] },
      ].map((wall, index) => (
        <mesh key={index} position={wall.position as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={wall.size as [number, number, number]} />
          <meshStandardMaterial color="#edf2f6" roughness={0.56} />
        </mesh>
      ))}

      <mesh position={[0, 1.04, 2.72]} castShadow receiveShadow>
        <boxGeometry args={[1.42, 0.08, 0.16]} />
        <meshStandardMaterial color="#d8e2ea" roughness={0.22} metalness={0.18} />
      </mesh>

      <mesh position={[-5.2, 1.02, 2.62]} rotation={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.84, 2.04, 0.12]} />
        <meshStandardMaterial color="#e7f2fa" transparent opacity={0.16} roughness={0.44} metalness={0.08} />
      </mesh>
      <WindowWall position={[-5.2, 1.18, 2.67]} width={4.2} height={1.4} />
      <CurtainPair position={[-5.2, 1.18, 2.72]} width={4.1} />

      <WindowWall position={[-3.89, 1.48, 0]} width={4.4} height={1.9} />
      <CurtainPair position={[-3.94, 1.46, 0]} width={4.2} />

      <DoorFrame position={[-3.44, 0, -0.96]} />
      <DoorFrame position={[3.1, 0, -3.52]} />

      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[7.9, 0.08, 5.7]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.02} />
      </mesh>

      <LightStrip position={[-1.98, 0.09, -4.1]} size={[0.04, 0.04, 4.12]} intensity={0.18} reducedMotion={reducedMotion} />
      <LightStrip position={[3.1, 0.09, -4.1]} size={[0.04, 0.04, 4.12]} intensity={0.18} reducedMotion={reducedMotion} pulseOffset={0.8} />
      <LightStrip position={[2.5, 0.09, -2.76]} size={[1.18, 0.04, 0.04]} intensity={0.14} reducedMotion={reducedMotion} pulseOffset={1.4} />

      {!reducedDetail ? <Artwork position={[7.76, 1.52, -1.1]} /> : null}
    </group>
  )
}

function LivingZone({ reducedDetail, reducedMotion }: { reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group>
      <Sofa position={[-0.32, 0.02, 0.68]} />
      <CoffeeTable position={[-0.26, 0.02, -0.52]} />
      <mesh position={[-0.28, 0.04, -0.58]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.9, 2.55]} />
        <meshStandardMaterial color="#b7c5d1" roughness={0.92} />
      </mesh>
      <MediaConsole position={[2.26, 0.02, -1.66]} reducedMotion={reducedMotion} />
      <SmartSpeakerDock position={[0.92, 0.5, -0.82]} reducedMotion={reducedMotion} />
      <LightStrip position={[2.92, 0.56, -1.42]} size={[0.02, 0.72, 0.02]} intensity={0.32} reducedMotion={reducedMotion} pulseOffset={0.6} />
      {!reducedDetail ? (
        <>
          <mesh position={[1.96, 0.56, 0.56]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.3, 0.42, 18]} />
            <meshStandardMaterial color="#c4d1db" roughness={0.22} metalness={0.18} />
          </mesh>
          <mesh position={[1.96, 0.84, 0.56]} castShadow receiveShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#84daf0" emissive="#69def6" emissiveIntensity={0.42} roughness={0.22} />
          </mesh>
          <LightStrip position={[-1.9, 0.06, 1.58]} size={[1.62, 0.022, 0.022]} intensity={0.26} reducedMotion={reducedMotion} pulseOffset={1.3} />
        </>
      ) : null}
    </group>
  )
}

function KitchenZone({ mobile, reducedDetail, reducedMotion }: { mobile: boolean; reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group>
      <KitchenIsland position={[-5.32, 0.02, 0.2]} mobile={mobile} reducedMotion={reducedMotion} />
      <BarStool position={[-6.1, 0.02, -1.1]} />
      <BarStool position={[-5.32, 0.02, -1.18]} />
      <BarStool position={[-4.54, 0.02, -1.06]} />
      <DiningTable position={[-6.1, 0.02, 1.54]} mobile={mobile} reducedMotion={reducedMotion} />
      <DiningChair position={[-6.86, 0.02, 2.24]} rotation={[0, Math.PI * 0.12, 0]} />
      <DiningChair position={[-5.28, 0.02, 2.22]} rotation={[0, -Math.PI * 0.08, 0]} />
      <DiningChair position={[-6.88, 0.02, 0.82]} rotation={[0, Math.PI * 0.95, 0]} />
      <DiningChair position={[-5.32, 0.02, 0.78]} rotation={[0, Math.PI * 1.08, 0]} />
      <PendantLight position={[-5.38, 2.2, 0.22]} />
      <PendantLight position={[-6.08, 2.18, 1.54]} />
      <SmartPanel position={[-2.86, 1.52, 2.58]} rotation={[0, Math.PI, 0]} width={1.08} height={0.64} reducedMotion={reducedMotion} />
      <SmartSpeakerDock position={[-5.92, 0.96, 0.14]} reducedMotion={reducedMotion} />
      {!reducedDetail ? (
        <>
          <mesh position={[-7.6, 1.02, -1.64]} castShadow receiveShadow>
            <boxGeometry args={[0.76, 1.24, 0.38]} />
            <meshStandardMaterial color="#d7e3ec" roughness={0.16} metalness={0.22} />
          </mesh>
          <mesh position={[-2.98, 0.86, -1.72]} castShadow receiveShadow>
            <boxGeometry args={[0.44, 0.78, 0.28]} />
            <meshStandardMaterial color="#2f3a44" roughness={0.14} metalness={0.22} />
          </mesh>
          <LightStrip position={[-7.6, 0.1, -2.02]} size={[0.84, 0.026, 0.02]} intensity={0.22} reducedMotion={reducedMotion} pulseOffset={1.7} />
        </>
      ) : null}
    </group>
  )
}

function HallZone({ reducedDetail, reducedMotion }: { reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group>
      <HallRunner position={[2.48, 0.03, -4.06]} />
      <mesh position={[2.46, 1.56, -2.46]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.04, 1.66]} />
        <meshStandardMaterial color="#d3e1eb" emissive="#6fdbf6" emissiveIntensity={0.28} roughness={0.18} />
      </mesh>
      <SmartPanel position={[2.06, 1.54, -5.02]} rotation={[0, Math.PI / 2, 0]} width={0.9} height={0.56} reducedMotion={reducedMotion} />
      {!reducedDetail ? (
        <>
          <mesh position={[2.48, 0.42, -5.56]} castShadow receiveShadow>
            <boxGeometry args={[0.92, 0.34, 0.26]} />
            <meshStandardMaterial color="#4b5966" roughness={0.22} metalness={0.28} />
          </mesh>
          <LightStrip position={[2.48, 0.6, -5.42]} size={[0.72, 0.02, 0.02]} intensity={0.3} reducedMotion={reducedMotion} pulseOffset={0.2} />
        </>
      ) : null}
    </group>
  )
}

function StudioZone({ mobile, reducedDetail, reducedMotion }: { mobile: boolean; reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group>
      <DeskSetup position={[6.04, 0.02, -0.84]} mobile={mobile} reducedMotion={reducedMotion} />
      <DeskChair position={[6.02, 0.02, 0.06]} />
      <Bookshelf position={[7.86, 0.02, -2.78]} mobile={mobile} />
      <PendantLight position={[6.36, 2.14, -0.94]} />
      <SmartPanel position={[4.04, 1.54, -4.02]} rotation={[0, 0, 0]} width={1.12} height={0.68} reducedMotion={reducedMotion} />
      {!reducedDetail ? (
        <>
          <SmartSpeakerDock position={[6.42, 0.84, 0.06]} reducedMotion={reducedMotion} />
          <LightStrip position={[7.82, 0.12, -2.44]} size={[0.82, 0.024, 0.022]} intensity={0.24} reducedMotion={reducedMotion} pulseOffset={1.5} />
        </>
      ) : null}
    </group>
  )
}

function ApartmentFallbackModel({ mobile, reducedDetail, reducedMotion }: { mobile: boolean; reducedDetail: boolean; reducedMotion: boolean }) {
  return (
    <group position={[0, -0.55, 0]}>
      <ApartmentShell reducedDetail={reducedDetail} reducedMotion={reducedMotion} />
      <LivingZone reducedDetail={reducedDetail} reducedMotion={reducedMotion} />
      <KitchenZone mobile={mobile} reducedDetail={reducedDetail} reducedMotion={reducedMotion} />
      <HallZone reducedDetail={reducedDetail} reducedMotion={reducedMotion} />
      <StudioZone mobile={mobile} reducedDetail={reducedDetail} reducedMotion={reducedMotion} />
    </group>
  )
}

function ApartmentGLTF({ modelPath, mobile }: { modelPath: string; mobile: boolean }) {
  const group = useRef<Group | null>(null)
  const { scene } = useGLTF(modelPath)

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = !mobile
        child.receiveShadow = true
      }
    })
  }, [mobile, scene])

  return <primitive ref={group} object={scene} scale={mobile ? 0.9 : 1.05} position={[0, -0.85, 0]} />
}

function CameraRig({
  scenes,
  sceneIndex,
  localProgress,
  mobile,
  reducedMotion,
}: {
  scenes: LandingSceneDefinition[]
  sceneIndex: number
  localProgress: number
  mobile: boolean
  reducedMotion: boolean
}) {
  const targetRef = useRef(new Vector3())
  const positionRef = useRef(new Vector3())
  const { invalidate } = useThree()

  useFrame(({ camera }) => {
    const activeScene = scenes[sceneIndex] ?? scenes[0]
    const effectiveProgress = reducedMotion ? 0.58 : localProgress
    const next = resolveSceneCameraState(activeScene, mobile, effectiveProgress)
    positionRef.current.lerp(new Vector3(next.position.x, next.position.y, next.position.z), reducedMotion ? 0.24 : 0.12)
    targetRef.current.lerp(new Vector3(next.target.x, next.target.y, next.target.z), reducedMotion ? 0.24 : 0.12)
    camera.position.copy(positionRef.current)
    camera.lookAt(targetRef.current)
    invalidate()
  })

  return null
}

function LandingCanvasScene({
  sceneIndex,
  localProgress,
  mobile,
  reducedMotion,
  modelPath,
  useRealModel,
  reducedDetail,
}: {
  sceneIndex: number
  localProgress: number
  mobile: boolean
  reducedMotion: boolean
  modelPath: string
  useRealModel: boolean
  reducedDetail: boolean
}) {
  return (
    <Canvas frameloop="demand" dpr={mobile ? [0.62, 0.84] : reducedDetail ? [0.76, 1.0] : [0.82, 1.1]} shadows={!mobile && !reducedDetail} gl={{ antialias: !mobile && !reducedDetail, alpha: true, powerPreference: mobile ? 'low-power' : 'high-performance' }}>
      <PerspectiveCamera makeDefault position={[5, 3, 8]} fov={mobile ? 46 : 36} />
      <color attach="background" args={['#eff4f7']} />
      <fog attach="fog" args={['#eff4f7', 12, mobile ? 24 : 32]} />

      <ambientLight intensity={mobile ? 0.96 : 0.76} />
      <directionalLight
        position={[11, 10, 7]}
        intensity={mobile ? 1.08 : 1.24}
        castShadow={!mobile && !reducedDetail}
        shadow-mapSize-width={reducedDetail ? 512 : 640}
        shadow-mapSize-height={reducedDetail ? 512 : 640}
      />
      <directionalLight position={[-10, 6, -8]} intensity={0.24} color="#cfe9ff" />

      <Suspense fallback={<ApartmentFallbackModel mobile={mobile} reducedDetail={reducedDetail} reducedMotion={reducedMotion} />}>
        {useRealModel ? <ApartmentGLTF modelPath={modelPath} mobile={mobile} /> : <ApartmentFallbackModel mobile={mobile} reducedDetail={reducedDetail} reducedMotion={reducedMotion} />}
      </Suspense>

      {!mobile && !reducedDetail && !useRealModel ? <ContactShadows position={[0, -0.54, 0]} opacity={0.1} scale={18} blur={1.4} far={12} color="#C73E15" /> : null}

      <CameraRig scenes={landingScenes} sceneIndex={sceneIndex} localProgress={localProgress} mobile={mobile} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

function PromotionMiniCard({ promotion }: { promotion: Promotion }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/8 p-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{promotion.category}</p>
          <h4 className="mt-1 text-sm font-semibold text-white">{promotion.title}</h4>
          <p className="mt-1 text-xs text-white/70">{promotion.businessName}</p>
        </div>
        <div className="rounded-2xl bg-[#F04E23] px-3 py-2 text-center shadow-[0_10px_24px_rgba(240,78,35,0.35)]">
          <div className="text-lg font-semibold text-white">{promotion.discount}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/85">DTO</div>
        </div>
      </div>
    </div>
  )
}

function LandingFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(240,78,35,0.12),transparent_32%),linear-gradient(180deg,color-mix(in_srgb,var(--background)_88%,black_12%),var(--background))] px-5 py-10 text-foreground md:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">CITIFY</p>
          <h3 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
            Conectamos vecinos, comercios y edificios en una experiencia mas simple.
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            Si queres sumar tu comercio o llevar CITIFY a tu edificio, escribinos y te contamos como empezar.
          </p>
          <a
            href={CONTACT_LINKS.general}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            <Mail className="h-4 w-4" />
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="flex flex-col gap-5 md:items-end">
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <Icon className="h-4 w-4" />
                </a>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">Desarrollado por Digital Amenities</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground md:justify-end">
            <a href="/legal/terminos" className="hover:text-foreground transition-colors">
              Términos
            </a>
            <span aria-hidden>·</span>
            <a href="/legal/privacidad" className="hover:text-foreground transition-colors">
              Privacidad
            </a>
            <span aria-hidden>·</span>
            <a href="/legal/cookies" className="hover:text-foreground transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function ScenePanel({
  scene,
  featuredPromotions,
}: {
  scene: LandingSceneDefinition
  featuredPromotions: Promotion[]
}) {
  return (
    <div className="w-full max-w-[34rem] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
      <div className="px-1">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/75">
          {scene.eyebrow}
        </p>
        <h2 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{scene.headline}</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 md:text-base">
          {scene.body}
        </p>

        {scene.contentKey === 'welcome' ? (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {landingStats.map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-4">
                  <div className="text-2xl font-semibold">{stat.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/usuario">
                <Button size="lg" className="btn-premium gap-2 rounded-full px-7">
                  Descubri CITIFY <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/promotions">
                <Button size="lg" variant="outline" className="rounded-full border-white/40 bg-transparent px-7 text-white hover:bg-white/15">
                  Ver beneficios
                </Button>
              </Link>
            </div>
          </div>
        ) : null}

        {scene.contentKey === 'neighbors' ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {landingFeatures.slice(0, 4).map((feature) => {
              const Icon = iconForFeature(feature.icon)
              return (
                <div key={feature.title} className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{feature.title}</div>
                      <div className="mt-1 text-xs leading-5 opacity-75">{feature.description}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {scene.contentKey === 'promotions' ? (
          <div className="mt-8 space-y-3">
            {featuredPromotions.length ? (
              featuredPromotions.map((promotion) => <PromotionMiniCard key={promotion.id} promotion={promotion} />)
            ) : (
              <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md p-5 text-sm opacity-80">
                CITIFY tambien ayuda a descubrir nuevas oportunidades cerca de casa y a activar una red local con mas valor para el edificio.
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/15">
                <a href={CONTACT_LINKS.business}>Quiero sumar mi comercio</a>
              </Button>
              <Link href="/promotions">
                <Button className="btn-premium rounded-full px-6">Explorar CITIFY</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {scene.contentKey === 'consorcio' ? (
          <div className="mt-8 grid gap-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md p-5">
              <div className="text-sm font-semibold">Una comunidad que se mueve mejor</div>
              <p className="mt-2 text-sm leading-7 opacity-80">
                CITIFY acerca conversaciones, seguimiento y vida compartida en una experiencia mas simple para quienes administran y para quienes habitan el edificio.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {landingFeatures.slice(3).map((feature) => {
                const Icon = iconForFeature(feature.icon)
                return (
                  <div key={feature.title} className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{feature.title}</div>
                        <div className="mt-1 text-xs leading-5 opacity-75">{feature.description}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="btn-premium rounded-full px-6">
                <a href={CONTACT_LINKS.building}>Quiero llevar CITIFY a mi edificio</a>
              </Button>
            </div>
          </div>
        ) : null}

        {scene.contentKey === 'infrastructure' ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Mas valor para vecinos y comunidad',
                  'Mas visibilidad para comercios de cercania',
                  'Mas orden y participacion para el edificio',
                  'Una experiencia simple para sumarse y empezar',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-current/10 bg-black/5 px-4 py-3 text-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="btn-premium rounded-full px-6">
                <a href={CONTACT_LINKS.general}>Sumate a CITIFY</a>
              </Button>
              <Link href="/promotions">
                <Button variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/15">Conocer beneficios</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function LandingExperience3D({
  featuredPromotions,
  hasOptimizedModels,
}: {
  featuredPromotions: Promotion[]
  hasOptimizedModels: boolean
}) {
  const isMobile = useViewportMode()
  const prefersReducedMotion = useReducedMotionPreference()
  const reducedDetail = useReducedDetailMode(isMobile, prefersReducedMotion)
  const { sceneIndex, localProgress } = useLandingScrollProgress(landingScenes.length)
  const [modelAvailable, setModelAvailable] = useState(hasOptimizedModels)
  const modelPath = isMobile ? landingModelAsset.optimizedMobilePath : landingModelAsset.optimizedDesktopPath

  useEffect(() => {
    if (!hasOptimizedModels) {
      setModelAvailable(false)
      return
    }

    useGLTF.preload(landingModelAsset.optimizedDesktopPath)
    useGLTF.preload(landingModelAsset.optimizedMobilePath)
    setModelAvailable(true)
  }, [hasOptimizedModels])

  useEffect(() => {
    if (!hasOptimizedModels) {
      setModelAvailable(false)
      return
    }

    let cancelled = false
    async function checkModel() {
      try {
        const response = await fetch(modelPath, { method: 'HEAD' })
        if (!cancelled) {
          setModelAvailable(response.ok)
        }
      } catch {
        if (!cancelled) {
          setModelAvailable(false)
        }
      }
    }

    checkModel()

    return () => {
      cancelled = true
    }
  }, [hasOptimizedModels, modelPath])

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-x-clip bg-background">
      <div className="fixed inset-0 top-16 z-0">
        <ScrollVideoBackground />
      </div>

      <div className="relative z-20">
        {landingScenes.map((scene, index) => {
          const onLeft = index % 2 === 0
          return (
            <section
              key={scene.id}
              id={scene.id}
              className="relative flex min-h-screen items-center px-5 py-20 md:px-10"
              style={{ minHeight: `${SCENE_HEIGHT}vh` }}
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 ${
                  onLeft
                    ? 'bg-[linear-gradient(90deg,rgba(8,6,4,0.78)_0%,rgba(8,6,4,0.45)_28%,rgba(8,6,4,0.12)_55%,transparent_75%)]'
                    : 'bg-[linear-gradient(270deg,rgba(8,6,4,0.78)_0%,rgba(8,6,4,0.45)_28%,rgba(8,6,4,0.12)_55%,transparent_75%)]'
                }`}
              />
              <div className={`relative mx-auto flex w-full max-w-7xl ${onLeft ? 'justify-start' : 'justify-end'}`}>
                <ScenePanel scene={scene} featuredPromotions={featuredPromotions} />
              </div>
            </section>
          )
        })}

        <LandingFooter />
      </div>
    </div>
  )
}
