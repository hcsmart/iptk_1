-- v343 : 제작계획에 전체 이익금 · 관리비용(%) · 관리비 를 저장 (금형원가내역에서 목표 대비 달성률 표시용)
-- Supabase SQL Editor 에서 한 번만 실행하세요.
alter table public.sales_plans add column if not exists total_profit numeric;   -- 전체 이익금 (자동배분 입력값)
alter table public.sales_plans add column if not exists mgmt_pct     numeric;   -- 관리비용(%) — 수주가 대비
alter table public.sales_plans add column if not exists mgmt_amount  numeric;   -- 관리비 = 수주가 × 관리비용(%)
comment on column public.sales_plans.total_profit is '전체 이익금 (제작계획등록 자동배분 입력값)';
comment on column public.sales_plans.mgmt_pct     is '관리비용(%) — 수주가 대비';
comment on column public.sales_plans.mgmt_amount  is '관리비 = 수주가 × 관리비용(%)';
notify pgrst, 'reload schema';
