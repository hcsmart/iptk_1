-- v275: 제작계획등록 외주업체 칸 — 초품·완료 외주업체 컬럼 추가 (가공·조립은 기존 컬럼 사용)
alter table public.sales_plans add column if not exists tryout_vendor   text;
alter table public.sales_plans add column if not exists complete_vendor text;
notify pgrst, 'reload schema';
