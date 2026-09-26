/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin output: 'standalone'. En el VPS la app corre como servicio de systemd
  // con `next start` (igual que Countrify y las demas apps de la maquina), no
  // en Docker.
  //
  // Sin typescript.ignoreBuildErrors, a proposito: el proyecto no tiene tests y
  // con el chequeo apagado un import roto pasaba el build en verde y explotaba
  // en produccion. El arbol typechequea en 0; si un cambio rompe el build,
  // arreglar el tipo, no volver a poner la bandera.
  images: {
    unoptimized: true,
  },
  experimental: {
    // El alta de gasto manda el comprobante en base64 por server action
    // (app/iadmin/gastos/actions.ts) y el form acepta hasta 10MB, pero el
    // default de Next es 1MB. 12mb deja margen para el overhead de base64.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
