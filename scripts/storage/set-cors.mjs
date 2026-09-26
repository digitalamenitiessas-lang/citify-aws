#!/usr/bin/env node
/**
 * Configura el CORS de los dos buckets de Citify en Garage (o cualquier S3).
 *
 * Sin CORS, el navegador bloquea el PUT a la URL prefirmada (el preflight
 * OPTIONS muere) y ninguna subida funciona: comprobantes, logos, marketplace.
 *
 *   S3_ENDPOINT=http://127.0.0.1:3900 S3_REGION=garage \
 *   S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
 *   CORS_ORIGINS=https://citify.com.ar,https://www.citify.com.ar \
 *   node scripts/storage/set-cors.mjs
 *
 * Contra Garage conviene el endpoint local (127.0.0.1:3900): el CORS es config
 * del bucket y no depende del host. La key necesita permiso de owner.
 */

import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`error: falta ${name}`)
    process.exit(2)
  }
  return value
}

const origins = (process.env.CORS_ORIGINS ?? 'https://citify.com.ar,https://www.citify.com.ar')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const buckets = [
  process.env.S3_PUBLIC_BUCKET ?? 'citify-public',
  process.env.S3_PRIVATE_BUCKET ?? 'citify-private',
]

const client = new S3Client({
  endpoint: required('S3_ENDPOINT'),
  region: process.env.S3_REGION ?? 'garage',
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
  },
})

const rules = [
  {
    AllowedOrigins: origins,
    AllowedMethods: ['GET', 'PUT', 'HEAD'],
    // content-length tiene que estar permitido: lib/storage/s3.ts lo mete en
    // la firma del PUT (X-Amz-SignedHeaders=content-length;host).
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  },
]

for (const Bucket of buckets) {
  await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }))
  const current = await client.send(new GetBucketCorsCommand({ Bucket }))
  const r = current.CORSRules?.[0]
  console.log(`${Bucket}: origenes=${r?.AllowedOrigins?.join(' ')} metodos=${r?.AllowedMethods?.join(',')}`)
}
