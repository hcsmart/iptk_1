-- v230 : 영업관리 › SET외주 (설계외주와 같은 형식 — 관리제번 단위 발주·입고·현황)
-- Supabase SQL Editor 에서 한 번만 실행하세요. (여러 번 실행해도 안전)
--
-- 구성
--   발주   : order_lines  category = '외주SET'  (설계외주 = '외주설계' 와 같은 표)
--   입고   : set_outsourcing_receipts        (outsourced_design_receipts 와 같은 구조)
--   현황   : set_outsourcing_status_view     (outsourced_design_status_view 를 category 만 바꿔 복제)
--   업체   : set_order_partners              (기존 SET외주제작등록의 협력업체 마스터를 그대로 사용)
--   원가   : 금형원가내역 › 금형 공통비 › SET외주 행 (입고확정 금액 집계)

/* ── 1. order_lines.category 체크제약에 '외주SET' 허용 (제약이 있을 때만) ───────── */
do $$
declare c record; d text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where conrelid = 'public.order_lines'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%외주설계%'
  loop
    if c.def like '%외주SET%' then continue; end if;
    d := replace(c.def, '''외주설계''', '''외주설계'', ''외주SET''');
    execute format('alter table public.order_lines drop constraint %I', c.conname);
    execute format('alter table public.order_lines add constraint %I %s', c.conname, d);
  end loop;
end $$;

/* ── 2. 입고 이력 표 (설계외주 입고표와 같은 구조) ─────────────────────────── */
create table if not exists public.set_outsourcing_receipts
  (like public.outsourced_design_receipts including all);

alter table public.set_outsourcing_receipts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'set_outsourcing_receipts') then
    create policy set_outsourcing_receipts_all on public.set_outsourcing_receipts
      for all using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on public.set_outsourcing_receipts to anon, authenticated;
do $$
declare s record;
begin
  for s in select sequence_name from information_schema.sequences
            where sequence_schema = 'public' and sequence_name like 'set_outsourcing_receipts%'
  loop
    execute format('grant usage, select on sequence public.%I to anon, authenticated', s.sequence_name);
  end loop;
end $$;

/* ── 3. 현황 뷰 — 설계외주 현황 뷰 정의를 그대로 복제하고 category 만 바꾼다 ──────── */
do $$
declare v text;
begin
  v := pg_get_viewdef('public.outsourced_design_status_view'::regclass, true);
  v := replace(v, '외주설계', '외주SET');
  v := replace(v, 'outsourced_design_receipts', 'set_outsourcing_receipts');
  execute 'create or replace view public.set_outsourcing_status_view as ' || v;
end $$;
grant select on public.set_outsourcing_status_view to anon, authenticated;

/* ── 4. 실시간 알림(변경 통지)에 등록돼 있으면 새 표도 같이 ──────────────────── */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.set_outsourcing_receipts;
    exception when others then null;
    end;
  end if;
end $$;
