create table if not exists public.discards (
  job_id text primary key,
  reason text,
  discarded boolean not null default true,
  job jsonb,
  updated_at timestamptz not null default now()
);

alter table public.discards enable row level security;

create policy "anyone can read discards" on public.discards for select using (true);
create policy "anyone can add discards" on public.discards for insert with check (true);
create policy "anyone can update discards" on public.discards for update using (true) with check (true);
