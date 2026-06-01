-- 008_rafael_message_channel.sql
-- Adds a "channel" to Rafael's chat messages so the web chat and the Telegram
-- chat keep separate conversation histories (both still share the knowledge store).
alter table public.raphael_messages
  add column if not exists channel text not null default 'web';

create index if not exists raphael_messages_channel_idx
  on public.raphael_messages (channel, created_at);
