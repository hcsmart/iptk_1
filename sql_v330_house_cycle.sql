-- v330 : 사내가공 실적(design_results)에 가공 차수(cycle_no) 칸 추가
-- Supabase SQL Editor 에서 한 번만 실행하세요. (여러 번 실행해도 안전)
--
-- 왜 필요한가
--   사내외가공 발주 화면에서 [신규진행]으로 2차를 시작해도, 사내가공 완료 기록은 차수 구분이 없어
--   새 차수 줄에도 「완료」로 보였다. 앞으로 저장하는 사내가공 실적에 몇 차인지 함께 기록한다.
--   기존 기록(값 없음)은 1차로 본다.
alter table public.design_results add column if not exists cycle_no integer;
notify pgrst, 'reload schema';
