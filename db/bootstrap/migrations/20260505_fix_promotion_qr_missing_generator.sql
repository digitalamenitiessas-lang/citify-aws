-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260505_fix_promotion_qr_missing_generator.sql

create or replace function citify.generate_promotion_redemption_token()
returns text
language plpgsql
as $generate_token$
begin
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
end;
$generate_token$;
