-- v234 : 수주진척현황 [✕ 진행삭제] — 관리제번 단위 완전 삭제
-- Supabase SQL Editor 에서 한 번만 실행하세요. (여러 번 실행해도 안전)
--
-- 왜 필요한가
--   카드는 관리제번(26DSA057) 단위인데 삭제는 대표 공정 제번(26DSA057F) 하나만 지워 A·B 공정이 남았고,
--   기존 mes_reset_job_progress 가 만들어진 뒤 추가된 표(SET외주 입고, 차수, 분할입고 원장 …)는 지우지 않았다.
--   이 함수는 public 스키마에서 job_no 열을 가진 모든 표를 자동으로 찾아, 관리제번과 그 공정 제번(A~Z) 행을 전부 지운다.
--   job_no 가 없는 자식 표(외주가공 분할입고 원장 outsourcing_moves.line_id 등)는 FK 를 따라 먼저 지운다.
--
-- 사용 : select public.mes_purge_job_base('26DSA057');
--        → {"base":"26DSA057","deleted":123,"tables":{"order_lines":9,"sale_orders":3,...}}

create or replace function public.mes_purge_job_base(p_base text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_base   text := upper(trim(p_base));
  v_re     text;
  t        record;
  fk       record;
  n        bigint;
  total    bigint := 0;
  tabs     jsonb  := '{}'::jsonb;
  pass     int;
  left_cnt bigint;
  cols     text;
  refcols  text;
begin
  if v_base is null or v_base = '' then
    raise exception '관리제번이 비었습니다.';
  end if;
  -- 관리제번 그대로 이거나, 관리제번 + 공정 한 글자(A~Z)
  v_re := '^' || regexp_replace(v_base, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g') || '[A-Z]?$';

  -- ── 1. job_no 가 없는 자식 표 : FK 로 부모(job_no 있는 표)를 따라가 먼저 지운다 ──
  for fk in
    select c.conname,
           c.conrelid::regclass  as child,
           c.confrelid::regclass as parent,
           (select string_agg(quote_ident(a.attname), ',' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as child_cols,
           (select string_agg(quote_ident(a.attname), ',' order by k.ord)
              from unnest(c.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as parent_cols
      from pg_constraint c
      join pg_namespace ns on ns.oid = c.connamespace
     where c.contype = 'f' and ns.nspname = 'public'
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = c.confrelid::regclass::text and column_name = 'job_no')
       and not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = c.conrelid::regclass::text and column_name = 'job_no')
  loop
    begin
      execute format('delete from %s where (%s) in (select %s from %s where job_no ~ %L)',
                     fk.child, fk.child_cols, fk.parent_cols, fk.parent, v_re);
      get diagnostics n = row_count;
      if n > 0 then
        total := total + n;
        tabs := tabs || jsonb_build_object(fk.child::text, coalesce((tabs->>fk.child::text)::bigint, 0) + n);
      end if;
    exception when others then null;
    end;
  end loop;

  -- ── 2. job_no 열이 있는 모든 표 : FK 순서를 몰라도 되게 여러 번 돈다 ──
  for pass in 1..6 loop
    left_cnt := 0;
    for t in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables tb
          on tb.table_schema = c.table_schema and tb.table_name = c.table_name
       where c.table_schema = 'public' and c.column_name = 'job_no'
         and tb.table_type = 'BASE TABLE'
       order by case when c.table_name in ('jobs','sale_orders','job_pool') then 2 else 1 end, c.table_name
    loop
      begin
        execute format('delete from public.%I where job_no ~ %L', t.table_name, v_re);
        get diagnostics n = row_count;
        if n > 0 then
          total := total + n;
          tabs := tabs || jsonb_build_object(t.table_name, coalesce((tabs->>t.table_name)::bigint, 0) + n);
        end if;
      exception when foreign_key_violation then
        left_cnt := left_cnt + 1;         -- 자식이 남아 있음 → 다음 바퀴에서 다시
      when others then null;              -- 뷰·권한 등은 건너뜀
      end;
    end loop;
    exit when left_cnt = 0;
  end loop;

  -- ── 3. 화면 스냅샷(page_state) 의 제번 잔재는 화면이 다시 읽으면 정리되므로 건드리지 않는다 ──

  return jsonb_build_object('base', v_base, 'deleted', total, 'tables', tabs);
end $$;

grant execute on function public.mes_purge_job_base(text) to anon, authenticated;
