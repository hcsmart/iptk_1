-- v326 : 수정요청게시판에 캡쳐 이미지 첨부 (이미지 주소 목록을 JSON 문자열로 보관)
-- Supabase SQL Editor 에서 한 번만 실행하세요.
alter table public.mod_requests add column if not exists images text;
comment on column public.mod_requests.images is '첨부 이미지 공개 URL 목록 (JSON 배열) — mes-attach 버킷 parts/modreq/ 아래';
-- PostgREST 가 새 칸을 바로 알아보도록
notify pgrst, 'reload schema';
