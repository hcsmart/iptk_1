-- v299: 기준정보 > 업체관리 — 취급구분에 '기타' 추가
-- Supabase SQL Editor 에서 전체 실행. 여러 번 실행해도 안전하다.
--  · vendors 에 etc_flag(기타) 컬럼 추가
--  · 구분이 협력업체인데 취급구분(원자재/면삭/구매품/외주가공/설계/SET외주)이 하나도 없는 업체는 기타=Y
--  · 고객사만인 업체는 손대지 않는다

alter table public.vendors add column if not exists etc_flag boolean;

update public.vendors set etc_flag = true
 where etc_flag is distinct from true
   and replace(coalesce(vendor_type,''),' ','') like '%협력업체%'
   and coalesce(raw_material_flag,false)=false
   and coalesce(milling_flag,false)=false
   and coalesce(purchase_item_flag,false)=false
   and coalesce(outsourcing_flag,false)=false
   and coalesce(design_flag,false)=false
   and coalesce(set_outsourcing_flag,false)=false;

-- 다른 취급구분이 Y/N 으로 채워진 업체는 기타도 빈칸 대신 N 으로 (목록 표시 통일)
update public.vendors set etc_flag = false
 where etc_flag is null and outsourcing_flag is not null;

-- 확인
select vendor_code, vendor_name, vendor_type, partner_type
  from public.vendors
 where etc_flag
 order by vendor_code;
