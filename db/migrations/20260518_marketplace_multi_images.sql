-- Allow up to 4 images per marketplace item.
-- We keep image_path for backwards-compat (it's the "main" image, index 0).
-- extra_image_paths stores additional images (max 3 → total 4 with image_path).

alter table public.marketplace_items
  add column if not exists extra_image_paths text[] not null default '{}'::text[];

-- Safety: cap to 3 extras at the DB level.
alter table public.marketplace_items
  drop constraint if exists marketplace_items_extra_images_max;

alter table public.marketplace_items
  add constraint marketplace_items_extra_images_max
  check (array_length(extra_image_paths, 1) is null or array_length(extra_image_paths, 1) <= 3);
