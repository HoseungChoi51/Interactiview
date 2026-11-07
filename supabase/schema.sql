-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 한 번 실행하세요.
-- 서버만 service role 키로 접근하므로 RLS를 켜고 정책은 만들지 않습니다(브라우저에서 직접 접근 불가).

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  persona text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  kind text check (kind in ('quote', 'bridge', 'none')),
  citations jsonb not null default '[]',
  topics text[] not null default '{}',
  sensitive boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv on messages (visitor_id, persona, created_at);
create index if not exists messages_created on messages (created_at);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  visitor_id uuid not null references visitors(id) on delete cascade,
  kind text not null check (kind in ('resonate', 'more', 'off')),
  note text,
  created_at timestamptz not null default now(),
  unique (message_id, visitor_id, kind)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  persona text not null,
  original text not null,
  text text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'skipped', 'hidden')),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists questions_persona on questions (persona, status);

create table if not exists question_votes (
  question_id uuid not null references questions(id) on delete cascade,
  visitor_id uuid not null references visitors(id) on delete cascade,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (question_id, visitor_id)
);

alter table visitors enable row level security;
alter table messages enable row level security;
alter table reactions enable row level security;
alter table questions enable row level security;
alter table question_votes enable row level security;
