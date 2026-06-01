-- Screenshot recreations can intentionally vary wardrobe while keeping the
-- blueprint composition stable. Existing generations remain exact recreations.

alter table threads_generations
  add column if not exists recreation_strategy text not null default 'exact';

alter table threads_generations
  drop constraint if exists threads_generations_recreation_strategy_check;

alter table threads_generations
  add constraint threads_generations_recreation_strategy_check
  check (recreation_strategy in ('exact', 'subtle_outfit_variations', 'different_outfits'));

create index if not exists idx_threads_generations_recreation_strategy
  on threads_generations(recreation_strategy);
