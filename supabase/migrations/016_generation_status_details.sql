-- Keep enough queue detail to explain failed or slow image generations.

alter table threads_generations
  add column if not exists fal_queue_status text,
  add column if not exists error_message text;
