-- Optional cloud persistence for SellMate AI.
-- The app automatically uses demo mode when Supabase is not configured.

create table if not exists public.sellmate_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null check (char_length(state_key) between 1 and 80),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key)
);

alter table public.sellmate_state enable row level security;

create policy "Users can read their own SellMate state"
  on public.sellmate_state for select
  using (auth.uid() = user_id);

create policy "Users can create their own SellMate state"
  on public.sellmate_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own SellMate state"
  on public.sellmate_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);