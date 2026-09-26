-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260519_fix_post_complaint_case_message_overload.sql

-- Drop the legacy 3-argument overload of post_complaint_case_message so calls
-- without mentioned_profile_ids resolve unambiguously to the 4-argument
-- version introduced in 20260418_complaint_case_mentions.sql.
drop function if exists citify.post_complaint_case_message(
  uuid,
  text,
  citify.complaint_case_message_type
);
