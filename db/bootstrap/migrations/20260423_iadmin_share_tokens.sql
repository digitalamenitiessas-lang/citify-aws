-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260423_iadmin_share_tokens.sql

create table if not exists citify.iadmin_item_share_tokens (
  id uuid primary key default gen_random_uuid(),
  liquidation_item_id uuid not null references citify.iadmin_liquidation_items(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references citify.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  access_count integer not null default 0,
  last_accessed_at timestamptz
);

create index if not exists iadmin_item_share_tokens_item_idx
  on citify.iadmin_item_share_tokens (liquidation_item_id) where revoked_at is null;

-- Capacidad nueva
insert into citify.iadmin_capabilities (code, description) values
  ('liquidations.share', 'Compartir la liquidacion con el vecino (link publico)')
on conflict (code) do update set description = excluded.description;
