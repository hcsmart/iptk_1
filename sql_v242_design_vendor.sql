-- v242 : 수주등록 › 설계업체 (개발유형 「외주설계」 체크 시 입력)
-- Supabase SQL Editor 에서 한 번만 실행하세요. (여러 번 실행해도 안전)
alter table public.sale_orders add column if not exists design_vendor_name text;
comment on column public.sale_orders.design_vendor_name is '외주설계 업체 (수주등록 › 개발유형 외주설계 체크 시). 제작계획등록 설계처·설계외주발주 업체 자동선택에 이어진다';
