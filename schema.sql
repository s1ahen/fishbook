-- FishBook schema for West Coast Florida community catch log
-- Run this in the Supabase SQL editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Catches table
create table if not exists catches (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  username      text not null,
  avatar        text,
  fish_type     text not null,
  weight_lbs    numeric(10,2) not null check (weight_lbs > 0),
  price_per_lb  numeric(10,2) not null,
  estimated_value numeric(10,2) generated always as (weight_lbs * price_per_lb) stored,
  photo_url     text,
  caught_at     timestamptz default now()
);

-- Leaderboard summary view
create or replace view leaderboard_summary as
select
  user_id,
  username,
  avatar,
  count(*)                          as catch_count,
  sum(estimated_value)              as total_value,
  max(weight_lbs)                   as max_weight,
  (
    select fish_type
    from catches c2
    where c2.user_id = c.user_id
    order by estimated_value desc
    limit 1
  )                                 as best_fish,
  (
    select estimated_value
    from catches c3
    where c3.user_id = c.user_id
    order by estimated_value desc
    limit 1
  )                                 as best_fish_value
from catches c
group by user_id, username, avatar
order by total_value desc;

-- Row Level Security
alter table catches enable row level security;

-- Public can read all catches
create policy "Public read catches"
  on catches for select
  using (true);

-- Anyone can insert (authenticated via Discord user_id in app logic)
create policy "Open insert catches"
  on catches for insert
  with check (true);

-- Storage bucket for catch photos
-- Run in Supabase Dashboard > Storage > New bucket: catch-photos (public)
-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('catch-photos', 'catch-photos', true)
on conflict (id) do nothing;

create policy "Public read catch-photos"
  on storage.objects for select
  using (bucket_id = 'catch-photos');

create policy "Authenticated upload catch-photos"
  on storage.objects for insert
  with check (bucket_id = 'catch-photos');
