-- v370 : 도면변환 진행률 — 변환 PC 프로그램(v370 이상)이 진행률(0~100)과 단계 설명을 남긴다.
-- (운영 DB 에는 이미 적용됨. 새 프로젝트에 옮길 때 Supabase SQL Editor 에서 한 번 실행)
alter table public.dwg_convert_jobs add column if not exists progress smallint;
alter table public.dwg_convert_jobs add column if not exists progress_text text;
comment on column public.dwg_convert_jobs.progress is '변환 진행률 0~100 (변환 PC 프로그램 v370 이상이 기록)';
comment on column public.dwg_convert_jobs.progress_text is '진행 단계 설명 (예: 도곽 12/34 처리 중)';
notify pgrst, 'reload schema';
