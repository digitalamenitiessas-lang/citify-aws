-- Drop the legacy 3-argument overload of post_complaint_case_message so calls
-- without mentioned_profile_ids resolve unambiguously to the 4-argument
-- version introduced in 20260418_complaint_case_mentions.sql.
drop function if exists public.post_complaint_case_message(
  uuid,
  text,
  public.complaint_case_message_type
);
