-- v292: 기준정보 > 업체관리 — 고객사 일괄 추가 (없는 것만)
-- Supabase SQL Editor 에서 전체 실행. 여러 번 실행해도 중복으로 들어가지 않는다.
--  · 같은 업체명(공백·대소문자 무시)이 이미 있으면 건너뛴다 (구분이 달라도 건너뜀 → 결과표에 표시)
--  · 업체코드는 기존 코드 중 가장 많이 쓰는 [접두어+숫자] 규칙의 다음 번호 (화면 자동코드와 같은 규칙)
--    기존 코드가 없거나 규칙이 없으면 C001, C002 …

with wanted(ord, name, loc) as (values
  -- 나라 = 기존 '나라엠앤디'(V1000) 와 같은 회사라 제외
  (2,'금강','국내'),
  (3,'MACO','국내'),
  (4,'LG','국내'),
  (5,'LG 인도','해외'),
  (6,'DAS','국내'),
  (7,'UDAS(미국)','해외'),
  (8,'IDAS(인도)','해외'),
  (9,'정명','국내'),
  (10,'태광','국내'),
  (11,'닷코','국내')
),
codes as (
  select substring(vendor_code from '^([A-Za-z][A-Za-z_\-]*)\d+$') as p,
         substring(vendor_code from '(\d+)$')::int as n,
         length(substring(vendor_code from '(\d+)$')) as w
  from public.vendors
  where vendor_code ~ '^[A-Za-z][A-Za-z_\-]*\d+$'
),
rule as (
  select coalesce((select p from codes group by p order by count(*) desc, p limit 1),'C') as p
),
base as (
  select r.p,
         coalesce((select max(n) from codes c where c.p=r.p),0) as mx,
         greatest(coalesce((select max(w) from codes c where c.p=r.p),3),1) as w
  from rule r
),
todo as (
  select w.ord, w.name, w.loc,
         row_number() over (order by w.ord) as k
  from wanted w
  where not exists (
    select 1 from public.vendors v
    where lower(replace(coalesce(v.vendor_name,''),' ',''))=lower(replace(w.name,' ',''))
  )
),
ins as (
  insert into public.vendors (vendor_code, vendor_name, vendor_type, location_type)
  select b.p || lpad((b.mx + t.k)::text, b.w, '0'), t.name, '고객사', t.loc
  from todo t cross join base b
  where not exists (select 1 from public.vendors v where v.vendor_code = b.p || lpad((b.mx + t.k)::text, b.w, '0'))
  returning vendor_code, vendor_name
)
select w.ord as "순번", w.name as "업체명",
       case when i.vendor_code is not null then '추가됨 ('||i.vendor_code||')'
            else '이미 있음 — '||coalesce((select string_agg(v.vendor_code||' / '||coalesce(v.vendor_type,'구분없음'),', ')
                                          from public.vendors v
                                          where lower(replace(coalesce(v.vendor_name,''),' ',''))=lower(replace(w.name,' ',''))),'')
       end as "결과"
from wanted w left join ins i on i.vendor_name = w.name
order by w.ord;
