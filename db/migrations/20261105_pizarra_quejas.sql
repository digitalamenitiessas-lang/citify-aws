-- Pizarra de quejas del edificio.
--
-- Cada vecino publica una queja corta que ven todos los vecinos de su
-- edificio. Puede publicarla con su nombre o anonima. Los demas
-- vecinos pueden "sumarse" (me pasa lo mismo). La administracion responde en
-- publico, marca el estado y puede ocultar una queja ofensiva.
--
-- Reemplaza, por ahora, al sistema de expedientes (complaint_cases), que queda
-- intacto pero apagado (lib/features.ts).
--
-- ANONIMATO: author_profile_id se guarda siempre (para que el autor vea y
-- borre las suyas, para limitar el abuso y para que el superadmin pueda
-- revisar un caso grave en la base). Pero NINGUNA pantalla lo recibe cuando
-- is_anonymous = true: ni los vecinos ni el administrador. Lo resuelve
-- lib/db/board.ts, que nunca manda el id del autor al navegador.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'board_post_status' and n.nspname = 'citify'
  ) then
    create type citify.board_post_status as enum ('recibida', 'en_curso', 'resuelta');
  end if;
end
$$;

create table if not exists citify.board_posts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references citify.buildings(id) on delete cascade,
  author_profile_id uuid not null references citify.profiles(id) on delete cascade,
  is_anonymous boolean not null default true,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status citify.board_post_status not null default 'recibida',
  status_changed_at timestamptz,
  -- Ocultada por la administracion: los demas vecinos dejan de verla.
  hidden_at timestamptz,
  hidden_by uuid references citify.profiles(id) on delete set null,
  -- Borrada por su autor.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_posts_building_idx
  on citify.board_posts (building_id, created_at desc)
  where deleted_at is null;

create index if not exists board_posts_author_idx
  on citify.board_posts (author_profile_id, created_at desc);

-- "Me pasa lo mismo": un voto por vecino y queja.
create table if not exists citify.board_post_supports (
  post_id uuid not null references citify.board_posts(id) on delete cascade,
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists board_post_supports_profile_idx
  on citify.board_post_supports (profile_id);

-- Respuestas de la administracion, visibles para todos los vecinos.
create table if not exists citify.board_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references citify.board_posts(id) on delete cascade,
  author_profile_id uuid references citify.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists board_post_replies_post_idx
  on citify.board_post_replies (post_id, created_at);

drop trigger if exists set_board_posts_updated_at on citify.board_posts;
create trigger set_board_posts_updated_at
  before update on citify.board_posts
  for each row execute function citify.set_updated_at();
