-- v272: 가공 테스트용 샘플 — 3공정 금형 수주 + PartList(원재료) 공정별 5종
--  관리제번 26TEST01 → 공정 제번 26TEST01A · 26TEST01B · 26TEST01C
--  Supabase SQL Editor 에서 한 번 실행. 여러 번 실행해도 중복되지 않음.
--  지울 때: 영업관리 › 수주진척현황 에서 26TEST01 [✕ 진행삭제] (또는 맨 아래 정리 SQL)

begin;

-- 1) 제번(jobs) → 수주(sale_orders) → 수주현황(sale_order_status_rows) — 수주등록 화면이 저장하는 순서와 같음
insert into public.jobs (job_no, item_name, customer_name, order_status, order_date, source_count)
select j, '테스트 프레스금형', '테스트고객', '진행', current_date, 1
from unnest(array['26TEST01A','26TEST01B','26TEST01C']) as j
on conflict (job_no) do nothing;

insert into public.sale_orders (job_no, plant_name, order_status, order_type, item_name, customer_name, model, product_name,
  order_date, s1_planned_date, delivery_planned_date, development_type, process_set_qty, domestic_overseas, remark)
select j, '1공장', '진행', '신작', '테스트 프레스금형', '테스트고객', 'TEST-PN-01', '가공테스트 브라켓',
  current_date, current_date + 30, current_date + 45, '사내설계,사내조립', '3', '국내', '가공 테스트용 샘플 (v272)'
from unnest(array['26TEST01A','26TEST01B','26TEST01C']) as j
on conflict (job_no) do nothing;

insert into public.sale_order_status_rows (job_no, model, item_name, customer_name, set_qty, development_type, order_type,
  order_date, s1_planned_date, order_status, plant_name)
select j, 'TEST-PN-01', '테스트 프레스금형', '테스트고객', 3, '사내설계,사내조립', '신작',
  current_date, current_date + 30, '진행', '1공장'
from unnest(array['26TEST01A','26TEST01B','26TEST01C']) as j
where not exists (select 1 from public.sale_order_status_rows s where s.job_no = j);

-- 2) 재질·품번 마스터 (PartList 의 FK) — 없을 때만 추가
insert into public.materials (material_code, material_name)
values ('SKD11','SKD11'), ('S45C','S45C'), ('SUJ2','SUJ2'), ('SS400','SS400')
on conflict (material_code) do nothing;

create temp table _smp (job_no text, part_no text, part_name text, material text, shape text, spec text, thickness_dia numeric, width numeric, length numeric, qty numeric) on commit drop;
insert into _smp values
  -- A 공정 (블랭킹)
  ('26TEST01A','TA-101','상형 다이 플레이트','SKD11','사각','250*180', 40, 180, 250, 1),
  ('26TEST01A','TA-102','하형 다이 플레이트','SKD11','사각','250*180', 45, 180, 250, 1),
  ('26TEST01A','TA-103','블랭킹 펀치','SKD11','환봉','Ø30*80', 30, null, 80, 4),
  ('26TEST01A','TA-104','스트리퍼 플레이트','S45C','판재','300*200', 25, 200, 300, 1),
  ('26TEST01A','TA-105','가이드 포스트','SUJ2','환봉','Ø25*150', 25, null, 150, 4),
  -- B 공정 (포밍)
  ('26TEST01B','TB-101','포밍 상형','SKD11','사각','220*160', 50, 160, 220, 1),
  ('26TEST01B','TB-102','포밍 하형','SKD11','사각','220*160', 55, 160, 220, 1),
  ('26TEST01B','TB-103','패드','S45C','사각','180*120', 30, 120, 180, 1),
  ('26TEST01B','TB-104','포밍 펀치','SKD11','사각','60*40', 70, 40, 60, 2),
  ('26TEST01B','TB-105','백킹 플레이트','SS400','판재','300*220', 20, 220, 300, 1),
  -- C 공정 (피어싱)
  ('26TEST01C','TC-101','피어싱 다이','SKD11','사각','200*150', 35, 150, 200, 1),
  ('26TEST01C','TC-102','피어싱 펀치','SKD11','환봉','Ø12*70', 12, null, 70, 6),
  ('26TEST01C','TC-103','펀치 홀더','S45C','사각','200*150', 30, 150, 200, 1),
  ('26TEST01C','TC-104','스트리퍼','S45C','판재','220*160', 20, 160, 220, 1),
  ('26TEST01C','TC-105','가이드 부시','SUJ2','환봉','Ø35*50', 35, null, 50, 4);

insert into public.parts (part_code, part_name)
select part_no, part_name from _smp
on conflict (part_code) do nothing;

insert into public.partlist_materials (job_no, process_code, part_no, part_name, material, shape, spec,
  thickness_dia, width, length, qty, registered_by, registered_date)
select job_no, '1', part_no, part_name, material, shape, spec, thickness_dia, width, length, qty, '샘플', current_date
from _smp
on conflict (job_no, process_code, part_no) do nothing;

commit;

-- 확인
-- select job_no, part_no, part_name, material, spec, qty from public.partlist_materials where job_no like '26TEST01%' order by job_no, part_no;

-- 정리 (테스트 끝나고 지울 때 — 수주진척현황 [✕ 진행삭제] 가 더 깨끗함)
-- delete from public.order_lines           where job_no like '26TEST01%';
-- delete from public.machining_plan_parts  where job_no like '26TEST01%';
-- delete from public.partlist_materials    where job_no like '26TEST01%';
-- delete from public.sale_order_status_rows where job_no like '26TEST01%';
-- delete from public.sale_orders           where job_no like '26TEST01%';
-- delete from public.jobs                  where job_no like '26TEST01%';
