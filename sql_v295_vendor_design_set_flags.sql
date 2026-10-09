-- v295: 기준정보 > 업체관리 — 취급구분에 설계 / SET외주 추가 (협력업체구분 입력란·열 제거)
-- Supabase SQL Editor 에서 전체 실행. 여러 번 실행해도 안전하다.
--  · vendors 에 design_flag(설계), set_outsourcing_flag(SET외주) 컬럼 추가
--  · 기존 협력업체구분(partner_type) 이 '설계' / 'SET 외주' 인 업체는 해당 체크를 자동으로 켠다
--  · partner_type 컬럼은 지우지 않는다 (MCT·와이어·레이저 등 다른 값 보존용, 화면에는 더 이상 표시 안 함)

alter table public.vendors
  add column if not exists design_flag boolean,
  add column if not exists set_outsourcing_flag boolean;

update public.vendors set design_flag = true
 where design_flag is distinct from true
   and replace(coalesce(partner_type,''),' ','') = '설계';

update public.vendors set set_outsourcing_flag = true
 where set_outsourcing_flag is distinct from true
   and replace(coalesce(partner_type,''),' ','') in ('SET외주','세트외주');

-- 기존 취급구분(원자재 등)이 Y/N 으로 채워진 업체는 새 열도 빈칸 대신 N 으로 맞춘다 (목록 표시 통일)
update public.vendors
   set design_flag = coalesce(design_flag,false),
       set_outsourcing_flag = coalesce(set_outsourcing_flag,false)
 where outsourcing_flag is not null
   and (design_flag is null or set_outsourcing_flag is null);

-- 확인
select vendor_code, vendor_name, partner_type, design_flag, set_outsourcing_flag
  from public.vendors
 where design_flag or set_outsourcing_flag
 order by vendor_code;
