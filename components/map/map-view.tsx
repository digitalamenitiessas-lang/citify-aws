'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
// Agrega L.maplibreGL: dibuja mapas vectoriales de MapLibre como una capa mas
// de Leaflet, asi markers, popups y eventos siguen siendo de react-leaflet.
import '@maplibre/maplibre-gl-leaflet'
import { MapPin, Building, Store } from 'lucide-react'

// Mapa base: OpenFreeMap. Sin API key, sin registro y sin limite de uso.
//
// Antes eran los mosaicos de CARTO (light_all / dark_all), que en 2026 pasaron
// a exigir API key: sin ella cada mosaico se reemplaza por una imagen que dice
// "API KEY REQUIRED" y el mapa queda inservible (el punto se ubicaba igual,
// pero sobre un mapa tapado por el cartel).
//
// Positron y Dark son los mismos diseños que usaba CARTO, asi que el mapa se
// ve igual que antes. OpenFreeMap entrega vectores, no imagenes: por eso
// MapLibre en vez de un TileLayer.
const BASEMAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const BASEMAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'

// Sin WebGL MapLibre no puede dibujar. Respaldo: mosaicos de OpenStreetMap,
// tambien sin key (su politica pide uso moderado, que con este respaldo raro
// sobra).
const FALLBACK_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function BaseLayer({ dark }: { dark: boolean }) {
  const map = useMap()

  useEffect(() => {
    const layer = supportsWebGL()
      ? L.maplibreGL({ style: dark ? BASEMAP_STYLE_DARK : BASEMAP_STYLE_LIGHT })
      : L.tileLayer(FALLBACK_TILE_URL, { attribution: FALLBACK_ATTRIBUTION, maxZoom: 19 })

    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [map, dark])

  return null
}

// Fix default icons if ever needed (React-Leaflet standard fix)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom beautiful icons
const createCustomIcon = (type: 'default' | 'business' | 'building' | 'selected') => {
  const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  let iconHtml = ''

  if (type === 'building') {
    iconHtml = `<div class="w-10 h-10 flex items-center justify-center rounded-full bg-primary/20 border-2 border-primary text-primary backdrop-blur-md shadow-lg transition-transform hover:scale-110">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
    </div>`
  } else if (type === 'business') {
    iconHtml = `<div class="w-8 h-8 flex items-center justify-center rounded-full bg-teal-500/20 border-2 border-teal-500 text-teal-800 dark:text-teal-400 backdrop-blur-md shadow-md transition-transform hover:scale-110">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>
    </div>`
  } else if (type === 'selected') {
    iconHtml = `<div class="w-10 h-10 flex items-center justify-center rounded-full bg-rose-500/20 border-2 border-rose-500 text-rose-500 backdrop-blur-md shadow-lg animate-bounce">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>
    </div>`
  } else {
    iconHtml = `<div class="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary backdrop-blur-md shadow-md">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>`
  }

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-none',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

export interface MapMarker {
  id: string
  lat: number
  lng: number
  type: 'business' | 'building' | 'selected' | 'default'
  popupContent?: React.ReactNode
}

interface MapViewProps {
  center: [number, number]
  zoom?: number
  markers?: MapMarker[]
  // Cuando este key cambia, el mapa se re-centra explicitamente. Sirve
  // para que el caller pueda hacer "recenter on demand" (ej. despues de
  // geocodificar una direccion nueva) sin perder el drag/zoom que el
  // usuario hizo manualmente.
  recenterKey?: number
  interactive?: boolean
  onLocationSelect?: (lat: number, lng: number) => void
  selectedLocation?: [number, number] | null
  className?: string
}

function LocationSelector({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function ChangeView({
  center,
  zoom,
  recenterKey = 0,
}: {
  center: [number, number]
  zoom: number
  recenterKey?: number
}) {
  const map = useMap()
  const initializedRef = useRef(false)
  const lastRecenterKeyRef = useRef(recenterKey)

  useEffect(() => {
    // Primera vez: aplicar el centro/zoom inicial.
    if (!initializedRef.current) {
      map.setView(center, zoom)
      initializedRef.current = true
      lastRecenterKeyRef.current = recenterKey
      return
    }

    // Re-centrar solo cuando el caller bumpea recenterKey.
    if (recenterKey !== lastRecenterKeyRef.current) {
      map.setView(center, zoom)
      lastRecenterKeyRef.current = recenterKey
    }
  }, [center, zoom, recenterKey, map])

  return null
}

export default function MapView({
  center,
  zoom = 15,
  markers = [],
  recenterKey = 0,
  interactive = true,
  onLocationSelect,
  selectedLocation,
  className = '',
}: MapViewProps) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // Sigue el tema de la app: next-themes pone la clase `dark` en <html>
    // (components/providers.tsx, con enableSystem={false}: la preferencia del
    // sistema operativo NO cuenta). Antes tambien se miraba prefers-color-scheme
    // y solo al montar, asi que con la compu en modo oscuro el mapa quedaba
    // oscuro aunque se eligiera el tema claro, y no cambiaba con el boton.
    const root = document.documentElement
    const sync = () => setDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`rounded-xl overflow-hidden glass border relative ${className}`} style={{ height: '100%', minHeight: '300px', width: '100%', zIndex: 0 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <ChangeView center={center} zoom={zoom} recenterKey={recenterKey} />
        <BaseLayer dark={dark} />

        {onLocationSelect && <LocationSelector onSelect={onLocationSelect} />}

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createCustomIcon(marker.type)}
          >
            {marker.popupContent && (
              <Popup className="glass-popup">
                {marker.popupContent}
              </Popup>
            )}
          </Marker>
        ))}

        {selectedLocation && (
          <Marker
            position={selectedLocation}
            icon={createCustomIcon('selected')}
          />
        )}
      </MapContainer>

      {/* Global CSS for the popup glassmorphism */}
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: rgba(var(--background), 0.8) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          color: inherit !important;
          border: 1px solid rgba(var(--border), 0.5) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1) !important;
        }
        .leaflet-popup-tip {
          background: rgba(var(--background), 0.8) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(var(--border), 0.5) !important;
          border-width: 0 1px 1px 0 !important;
        }
        .dark .leaflet-popup-content-wrapper,
        .dark .leaflet-popup-tip {
          background: rgba(10, 10, 10, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-popup-content {
          margin: 14px !important;
          line-height: 1.5 !important;
        }
        .leaflet-container {
          background: transparent !important;
        }
      `}</style>
    </div>
  )
}
