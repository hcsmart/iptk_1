-- v285: 제번관리.xlsx → 제작계획등록(sales_plans) 일괄 반영 — 26DSA055A~F, 26ILA054A
--  엑셀의 요구·목표·가능 일정(접수·설계·가공·조립·초품·완료), 재질·사이즈·고객담당·설계처·제작처·양산처,
--  ● 진척현황(진척 메모)과 ◐ 유사제번(특기사항)을 옮긴다.  sql_v284 실행 뒤에 실행.
--  Supabase SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전:
--   · 계획이 없는 제번 → 새로 넣는다
--   · 이미 있는 제번 → 비어 있는 칸만 채우고, 진척현황은 기록이 없을 때만 넣는다 (화면에서 입력한 값은 유지)

-- 관리제번별 값 (공정 제번 전체에 같은 계획 — 제작계획등록 화면 v183 과 같은 방식)
create temp table _plan as
select v.job_no, h.*
from (values
  ('26DSA055', 'BASE PLATE-RECL INR, LH', 'MQ4i', '28731-MQI740', '(미입력)', '프레스금형', 6,
   '신규제작', 'SPFC780DP 3.2T', 'W220 * P132', '모종헌 책임 010-7237-7084', '베스텍ENG', '일평기연', '인디아(PUNE)',
   /* 요구일정 접수·설계·가공·조립·초품·완료 */   null::date, null::date, null::date, null::date, '2026-07-25'::date, '2026-07-30'::date,
   /* 목표일정 */ '2026-06-26'::date, '2026-07-08'::date, '2026-07-21'::date, '2026-07-23'::date, '2026-07-25'::date, '2026-07-30'::date,
   /* 가능일정 */ '2026-07-01'::date, '2026-07-11'::date, '2026-07-21'::date, '2026-07-23'::date, '2026-07-25'::date, '2026-07-30'::date,
   '[{"d":"2026-06-26","t":"제작접수"},{"d":"2026-06-30","t":"제작협의"},{"d":"2026-07-01","t":"변경도면 접수"},{"d":"2026-07-11","t":"도면출도"}]'::jsonb,
   null),
  ('26ILA054', 'HOLDER EVAPORATOR', 'VT6P', 'MEG66669810/11 : MEG66669909/10', 'LGEIL', '프레스금형', 1,
   '신규제작', 'AL 0.8T', '575(W) * 60(P)', 'Vishnu . VS', '세영(홍미란 대표)', '일평기연', '인디아(PUNE)',
   null::date, null::date, null::date, null::date, '2026-09-18'::date, '2026-09-30'::date,
   '2026-06-26'::date, '2026-08-28'::date, '2026-09-14'::date, '2026-09-16'::date, '2026-09-18'::date, '2026-09-30'::date,
   '2026-06-26'::date, '2026-08-28'::date, '2026-09-14'::date, '2026-09-16'::date, '2026-09-18'::date, '2026-09-30'::date,
   '[{"d":"2026-06-26","t":"제작접수(도면요청)"},{"d":"2026-07-13","t":"도면접수(제품도 재확인요청)"},{"d":"2026-07-31","t":"변경도면 접수"},{"d":"2026-08-04","t":"최종도면 접수"}]'::jsonb,
   '유사제번: 25ILA053')
) as h(base, product_name, model, drawing_no, customer_name, item_name, process_set_qty,
       make_type, material_spec, size_spec, customer_contact, design_partner, maker_name, mass_vendor,
       req_receipt_date, req_design_date, req_machining_date, req_assembly_date, req_tryout_date, req_complete_date,
       receipt_date, design_end_date, machining_end_date, assembly_end_date, s1_planned_date, delivery_planned_date,
       can_receipt_date, can_design_date, can_machining_date, can_assembly_date, can_tryout_date, can_complete_date,
       progress_log, remark)
join (values ('26DSA055A'),('26DSA055B'),('26DSA055C'),('26DSA055D'),('26DSA055E'),('26DSA055F'),('26ILA054A')) as v(job_no)
  on v.job_no like h.base || '%';

-- 1) 계획이 없는 제번 → 새로 넣기 (시작일은 앞 단계 목표일 다음 날)
insert into public.sales_plans (job_no, product_name, model, drawing_no, customer_name, item_name, process_set_qty, order_date,
  make_type, material_spec, size_spec, customer_contact, design_partner, design_vendor, design_outsourced, maker_name, mass_vendor,
  req_receipt_date, req_design_date, req_machining_date, req_assembly_date, req_tryout_date, req_complete_date,
  receipt_date, design_start_date, design_end_date, machining_start_date, machining_end_date, assembly_start_date, assembly_end_date,
  tryout_start_date, s1_planned_date, complete_start_date, delivery_planned_date,
  can_receipt_date, can_design_date, can_machining_date, can_assembly_date, can_tryout_date, can_complete_date,
  progress_log, remark)
select p.job_no, p.product_name, p.model, p.drawing_no, p.customer_name, p.item_name, p.process_set_qty, p.receipt_date,
  p.make_type, p.material_spec, p.size_spec, p.customer_contact, p.design_partner, p.design_partner, true, p.maker_name, p.mass_vendor,
  p.req_receipt_date, p.req_design_date, p.req_machining_date, p.req_assembly_date, p.req_tryout_date, p.req_complete_date,
  p.receipt_date, p.receipt_date, p.design_end_date, p.design_end_date + 1, p.machining_end_date, p.machining_end_date + 1, p.assembly_end_date,
  p.assembly_end_date + 1, p.s1_planned_date, p.s1_planned_date + 1, p.delivery_planned_date,
  p.can_receipt_date, p.can_design_date, p.can_machining_date, p.can_assembly_date, p.can_tryout_date, p.can_complete_date,
  p.progress_log, p.remark
from _plan p
where p.job_no in (select job_no from public.jobs)
  and not exists (select 1 from public.sales_plans s where s.job_no = p.job_no);

-- 2) 이미 있는 계획 → 빈 칸만 채우기 (진척현황은 기록이 없을 때만)
update public.sales_plans s set
  drawing_no        = coalesce(nullif(s.drawing_no,''), p.drawing_no),
  make_type         = coalesce(nullif(s.make_type,''), p.make_type),
  material_spec     = coalesce(nullif(s.material_spec,''), p.material_spec),
  size_spec         = coalesce(nullif(s.size_spec,''), p.size_spec),
  customer_contact  = coalesce(nullif(s.customer_contact,''), p.customer_contact),
  design_partner    = coalesce(nullif(s.design_partner,''), p.design_partner),
  maker_name        = coalesce(nullif(s.maker_name,''), p.maker_name),
  mass_vendor       = coalesce(nullif(s.mass_vendor,''), p.mass_vendor),
  req_tryout_date   = coalesce(s.req_tryout_date, p.req_tryout_date),
  req_complete_date = coalesce(s.req_complete_date, p.req_complete_date),
  receipt_date          = coalesce(s.receipt_date, p.receipt_date),
  design_end_date       = coalesce(s.design_end_date, p.design_end_date),
  machining_end_date    = coalesce(s.machining_end_date, p.machining_end_date),
  assembly_end_date     = coalesce(s.assembly_end_date, p.assembly_end_date),
  s1_planned_date       = coalesce(s.s1_planned_date, p.s1_planned_date),
  delivery_planned_date = coalesce(s.delivery_planned_date, p.delivery_planned_date),
  can_receipt_date   = coalesce(s.can_receipt_date, p.can_receipt_date),
  can_design_date    = coalesce(s.can_design_date, p.can_design_date),
  can_machining_date = coalesce(s.can_machining_date, p.can_machining_date),
  can_assembly_date  = coalesce(s.can_assembly_date, p.can_assembly_date),
  can_tryout_date    = coalesce(s.can_tryout_date, p.can_tryout_date),
  can_complete_date  = coalesce(s.can_complete_date, p.can_complete_date),
  progress_log = case when s.progress_log is null or jsonb_array_length(s.progress_log) = 0 then p.progress_log else s.progress_log end,
  remark       = coalesce(nullif(s.remark,''), p.remark)
from _plan p
where s.job_no = p.job_no;

-- 3) 제작계획현황 행 (없을 때만)
insert into public.sales_plan_status_rows (job_no, item_name, design_start_date, design_end_date, delivery_planned_date)
select p.job_no, p.item_name, p.receipt_date, p.design_end_date, p.delivery_planned_date
from _plan p
where p.job_no in (select job_no from public.jobs)
  and not exists (select 1 from public.sales_plan_status_rows r where r.job_no = p.job_no);

drop table _plan;

-- 확인
-- select job_no, receipt_date, design_end_date, s1_planned_date, delivery_planned_date, can_design_date, progress_log
--   from public.sales_plans where job_no like '26DSA055%' or job_no like '26ILA054%' order by job_no;
