import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import {
  deactivateMarketplaceItemInPostgres,
  updateMarketplaceItemInPostgres,
} from '@/lib/db/business'

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseImagePaths(body: any): { imagePath: string | null; extraImagePaths: string[] } {
  const imagePath = typeof body?.imagePath === 'string' && body.imagePath ? body.imagePath : null
  let extras: string[] = []
  if (Array.isArray(body?.imagePaths)) {
    extras = body.imagePaths.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
  } else if (Array.isArray(body?.extraImagePaths)) {
    extras = body.extraImagePaths.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
  }
  return { imagePath, extraImagePaths: extras.slice(0, 3) }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const condition = typeof body?.condition === 'string' ? body.condition.trim() : ''
  const price = Number(body?.price)
  const { imagePath, extraImagePaths } = parseImagePaths(body)

  if (!title || !description || !condition || !Number.isFinite(price)) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 })
  }

  try {
    await updateMarketplaceItemInPostgres({
      itemId: id,
      sellerProfileId: profile.id,
      title,
      price,
      description,
      condition,
      imagePath,
      extraImagePaths,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 },
    )
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id } = await context.params

  try {
    await deactivateMarketplaceItemInPostgres({
      itemId: id,
      sellerProfileId: profile.id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 },
    )
  }
}
