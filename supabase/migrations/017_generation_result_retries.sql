-- Retry transient fal result retrieval failures after the queue reports completion.

alter table threads_generations
  add column if not exists result_poll_attempts integer not null default 0;
