-- v358 : 도면변환 — 웹 [도면변환] 화면이 올린 DWG 변환 요청 · 사무실 PC 변환 프로그램(tools/dwg_agent)이 처리
-- Supabase SQL Editor 에서 한 번만 실행 (여러 번 실행해도 안전). 새 표만 추가하고 기존 자료는 건드리지 않는다.
-- 파일은 비공개 저장소 mes-drawing 의  convert/<요청번호>/src.dwg · pdf.zip · cad.zip  에 둔다 (권한은 sql_v160 그대로)

create table if not exists public.dwg_convert_jobs (
  id            bigint generated always as identity primary key,
  base_job      text,                          -- 관리제번 (예: 26ILA054)
  job_no        text not null,                 -- 제번 (예: 26ILA054A)
  src_name      text,                          -- 올린 파일 이름
  src_path      text not null,                 -- 저장소 경로
  status        text not null default 'waiting'
                check (status in ('waiting','working','done','error','cancelled')),
  message       text,                          -- 진행·결과·오류 안내
  pdf_path      text,                          -- 결과: 부품별 PDF zip
  cad_path      text,                          -- 결과: STEP·DXF zip
  summary       jsonb,                         -- 결과: 부품마다 확인목록
  requested_by  text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
create index if not exists dwg_convert_jobs_job_idx on public.dwg_convert_jobs (job_no, created_at desc);
create index if not exists dwg_convert_jobs_wait_idx on public.dwg_convert_jobs (status, created_at);

alter table public.dwg_convert_jobs enable row level security;
drop policy if exists auth_all on public.dwg_convert_jobs;
create policy auth_all on public.dwg_convert_jobs for all to authenticated
  using ((select mes_is_iptk_user())) with check ((select mes_is_iptk_user()));

-- 확인
-- select id, job_no, status, message, created_at from public.dwg_convert_jobs order by id desc limit 20;
