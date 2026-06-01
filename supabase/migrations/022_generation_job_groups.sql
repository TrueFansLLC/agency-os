-- Group multiple fal batches into one user-visible production job.
-- Existing batches become standalone jobs; future multi-screenshot uploads can
-- share one job id while retaining their individual fal batch ids for polling.

alter table threads_generations
  add column if not exists generation_job_id uuid;

update threads_generations
set generation_job_id = batch_id
where generation_job_id is null;

alter table threads_generations
  alter column generation_job_id set default gen_random_uuid(),
  alter column generation_job_id set not null;

create index if not exists idx_threads_generations_job
  on threads_generations(generation_job_id);
