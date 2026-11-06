import type { BoardPost, BoardPostStatus } from '@/lib/board'
import { pgQuery } from '@/lib/db/postgres'

// Pizarra de quejas (tablas en db/migrations/20261105_pizarra_quejas.sql).
//
// REGLA DE ANONIMATO: las funciones que alimentan una pantalla (list*) nunca
// devuelven el id del autor. El nombre y la unidad salen solo si la queja NO
// es anonima, y "es mia" se calcula aca, en SQL, contra el vecino que esta
// mirando. Asi una queja anonima no se puede desanonimizar ni mirando la
// respuesta en el navegador, ni siendo el administrador. getBoardPostMeta y
// getBoardSupporterIds si devuelven ids: son solo para permisos y avisos.

export type { BoardPost, BoardPostStatus, BoardReply } from '@/lib/board'

type BoardPostRow = {
  id: string
  building_id: string
  building_name: string
  body: string
  status: BoardPostStatus
  is_anonymous: boolean
  author_name: string | null
  author_unit: string | null
  support_count: number
  supported_by_me: boolean
  is_mine: boolean
  hidden: boolean
  created_at: Date
  replies: Array<{ id: string; body: string; created_at: string }>
}

// $1 = ids de edificios, $2 = vecino que mira (null para el administrador).
const SELECT_POSTS = `
  select bp.id,
         bp.building_id,
         b.name as building_name,
         bp.body,
         bp.status,
         bp.is_anonymous,
         case when bp.is_anonymous then null
              else coalesce(nullif(btrim(p.full_name), ''), 'Vecino') end as author_name,
         case when bp.is_anonymous then null
              else (select u.code
                      from citify.unit_profile_memberships m
                      join citify.iadmin_units u on u.id = m.unit_id
                     where m.profile_id = bp.author_profile_id
                       and m.building_id = bp.building_id
                       and m.active
                     order by m.is_primary desc, m.created_at
                     limit 1) end as author_unit,
         (select count(*)::int from citify.board_post_supports s where s.post_id = bp.id) as support_count,
         coalesce($2::uuid is not null and exists (
           select 1 from citify.board_post_supports s
            where s.post_id = bp.id and s.profile_id = $2::uuid
         ), false) as supported_by_me,
         coalesce(bp.author_profile_id = $2::uuid, false) as is_mine,
         bp.hidden_at is not null as hidden,
         bp.created_at,
         coalesce((
           select json_agg(json_build_object('id', r.id, 'body', r.body, 'created_at', r.created_at)
                           order by r.created_at)
             from citify.board_post_replies r
            where r.post_id = bp.id
         ), '[]'::json) as replies
    from citify.board_posts bp
    join citify.buildings b on b.id = bp.building_id
    join citify.profiles p on p.id = bp.author_profile_id
   where bp.building_id = any($1::uuid[])
     and bp.deleted_at is null`

function mapPost(row: BoardPostRow): BoardPost {
  return {
    id: row.id,
    buildingId: row.building_id,
    buildingName: row.building_name,
    body: row.body,
    status: row.status,
    isAnonymous: row.is_anonymous,
    authorName: row.author_name,
    authorUnit: row.author_unit,
    supportCount: row.support_count,
    supportedByMe: row.supported_by_me,
    isMine: row.is_mine,
    hidden: row.hidden,
    createdAt: new Date(row.created_at).toISOString(),
    replies: (row.replies ?? []).map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  }
}

/** La pizarra que ve un vecino: las de su edificio, menos las ocultas que no son suyas. */
export async function listBoardPostsForVecino(profileId: string, buildingId: string): Promise<BoardPost[]> {
  const res = await pgQuery<BoardPostRow>(
    `${SELECT_POSTS}
       and (bp.hidden_at is null or bp.author_profile_id = $2::uuid)
     order by bp.created_at desc
     limit 300`,
    [[buildingId], profileId],
  )
  return res.rows.map(mapPost)
}

/** La pizarra que ve el administrador: todas, incluidas las ocultas. */
export async function listBoardPostsForAdmin(buildingIds: string[]): Promise<BoardPost[]> {
  if (buildingIds.length === 0) return []
  const res = await pgQuery<BoardPostRow>(
    `${SELECT_POSTS}
     order by bp.created_at desc
     limit 500`,
    [buildingIds, null],
  )
  return res.rows.map(mapPost)
}

/** Quejas sin resolver y visibles, para el inicio del administrador. */
export async function countOpenBoardPosts(buildingIds: string[]): Promise<number> {
  if (buildingIds.length === 0) return 0
  const res = await pgQuery<{ n: number }>(
    `select count(*)::int as n
       from citify.board_posts
      where building_id = any($1::uuid[])
        and deleted_at is null
        and hidden_at is null
        and status <> 'resuelta'`,
    [buildingIds],
  )
  return res.rows[0]?.n ?? 0
}

/** Datos minimos de una queja para chequear permisos y avisar. Solo para el servidor. */
export async function getBoardPostMeta(postId: string): Promise<{
  buildingId: string
  buildingName: string
  authorProfileId: string
  isAnonymous: boolean
  body: string
  status: BoardPostStatus
  hidden: boolean
} | null> {
  const res = await pgQuery<{
    building_id: string
    building_name: string
    author_profile_id: string
    is_anonymous: boolean
    body: string
    status: BoardPostStatus
    hidden: boolean
  }>(
    `select bp.building_id, b.name as building_name, bp.author_profile_id, bp.is_anonymous,
            bp.body, bp.status, bp.hidden_at is not null as hidden
       from citify.board_posts bp
       join citify.buildings b on b.id = bp.building_id
      where bp.id = $1 and bp.deleted_at is null`,
    [postId],
  )
  const r = res.rows[0]
  if (!r) return null
  return {
    buildingId: r.building_id,
    buildingName: r.building_name,
    authorProfileId: r.author_profile_id,
    isAnonymous: r.is_anonymous,
    body: r.body,
    status: r.status,
    hidden: r.hidden,
  }
}

/** Cuantas quejas publico el vecino en las ultimas 24 horas (freno al abuso). */
export async function countRecentBoardPostsByAuthor(profileId: string): Promise<number> {
  const res = await pgQuery<{ n: number }>(
    `select count(*)::int as n
       from citify.board_posts
      where author_profile_id = $1
        and created_at > now() - interval '24 hours'`,
    [profileId],
  )
  return res.rows[0]?.n ?? 0
}

export async function insertBoardPost(input: {
  buildingId: string
  authorProfileId: string
  body: string
  isAnonymous: boolean
}): Promise<string> {
  const res = await pgQuery<{ id: string }>(
    `insert into citify.board_posts (building_id, author_profile_id, body, is_anonymous)
     values ($1, $2, $3, $4)
     returning id`,
    [input.buildingId, input.authorProfileId, input.body, input.isAnonymous],
  )
  return res.rows[0].id
}

/** Borra una queja propia. Devuelve false si no era del vecino. */
export async function softDeleteOwnBoardPost(postId: string, profileId: string): Promise<boolean> {
  const res = await pgQuery(
    `update citify.board_posts
        set deleted_at = now()
      where id = $1 and author_profile_id = $2 and deleted_at is null`,
    [postId, profileId],
  )
  return (res.rowCount ?? 0) > 0
}

/** Prende o apaga "me pasa lo mismo". Devuelve el estado nuevo. */
export async function toggleBoardSupport(postId: string, profileId: string): Promise<boolean> {
  const removed = await pgQuery(
    `delete from citify.board_post_supports where post_id = $1 and profile_id = $2`,
    [postId, profileId],
  )
  if ((removed.rowCount ?? 0) > 0) return false
  await pgQuery(
    `insert into citify.board_post_supports (post_id, profile_id)
     values ($1, $2)
     on conflict do nothing`,
    [postId, profileId],
  )
  return true
}

/** Quienes se sumaron a una queja (para avisarles cuando se resuelve). Solo para el servidor. */
export async function getBoardSupporterIds(postId: string): Promise<string[]> {
  const res = await pgQuery<{ profile_id: string }>(
    `select profile_id from citify.board_post_supports where post_id = $1`,
    [postId],
  )
  return res.rows.map((r) => r.profile_id)
}

export async function insertBoardReply(input: {
  postId: string
  authorProfileId: string
  body: string
}): Promise<void> {
  await pgQuery(
    `insert into citify.board_post_replies (post_id, author_profile_id, body)
     values ($1, $2, $3)`,
    [input.postId, input.authorProfileId, input.body],
  )
}

export async function updateBoardPostStatus(postId: string, status: BoardPostStatus): Promise<void> {
  await pgQuery(
    `update citify.board_posts
        set status = $2, status_changed_at = now()
      where id = $1 and status <> $2`,
    [postId, status],
  )
}

export async function setBoardPostHidden(postId: string, hidden: boolean, byProfileId: string): Promise<void> {
  await pgQuery(
    `update citify.board_posts
        set hidden_at = case when $2 then now() else null end,
            hidden_by = case when $2 then $3::uuid else null end
      where id = $1`,
    [postId, hidden, byProfileId],
  )
}
