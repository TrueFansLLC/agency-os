-- Automated visual QA compares generated recreations with their private blueprint.
-- It is a review aid, not an automatic publishing approval.

alter table threads_generations
  add column if not exists qa_status text not null default 'skipped',
  add column if not exists qa_score integer,
  add column if not exists qa_summary text,
  add column if not exists qa_details jsonb;

create index if not exists idx_threads_generations_qa_status on threads_generations(qa_status);
