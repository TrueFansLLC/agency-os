-- 007_raphael_brain.sql
-- Raphael "Second Brain": stores everything Elijah feeds in (PDFs, YouTube transcripts, notes)
-- and lets the assistant search it via German full-text search.
-- v1 uses Postgres full-text search (no embeddings) so only the Anthropic API key is needed.

-- A document = one thing Elijah fed in (one PDF, one YouTube video, one note).
create table if not exists public.raphael_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source_type  text not null default 'note',   -- 'note' | 'text' | 'pdf' | 'youtube'
  source_url   text,                            -- youtube link, etc. (nullable)
  raw_text     text,                            -- full extracted text (for reference)
  chunk_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

-- A chunk = a small searchable piece of a document (~1000 chars).
-- Raphael searches chunks, not whole documents, so answers stay focused.
create table if not exists public.raphael_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.raphael_documents(id) on delete cascade,
  content      text not null,
  -- German full-text search vector, auto-maintained by Postgres:
  content_tsv  tsvector generated always as (to_tsvector('german', content)) stored,
  created_at   timestamptz not null default now()
);

create index if not exists raphael_chunks_tsv_idx
  on public.raphael_chunks using gin (content_tsv);

create index if not exists raphael_chunks_document_idx
  on public.raphael_chunks (document_id);

-- Chat history with Raphael.
create table if not exists public.raphael_messages (
  id           uuid primary key default gen_random_uuid(),
  role         text not null,                   -- 'user' | 'assistant'
  content      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists raphael_messages_created_idx
  on public.raphael_messages (created_at);

grant all on public.raphael_documents to service_role;
grant all on public.raphael_chunks    to service_role;
grant all on public.raphael_messages  to service_role;
