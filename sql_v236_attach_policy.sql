-- v236 : 수주등록 첨부파일 — 저장소(mes-attach) 권한 정리
-- Supabase SQL Editor 에서 한 번만 실행하세요. (여러 번 실행해도 안전)
--
-- 증상 : 수주등록 › 첨부파일 › [파일첨부] 에서 "저장소 권한 없음"
-- 원인 후보
--   ① 버킷에 파일 형식 제한(allowed_mime_types = 이미지만) 또는 크기 제한이 걸려 있음
--   ② 삭제 정책이 없어 [파일삭제] 가 조용히 실패
--   ③ 정책이 로그인(authenticated) 사용자만 허용 — 로그인 토큰이 만료된 채 화면을 오래 열어 둔 경우
-- 이 스크립트는 ①②를 고치고, 마지막 조회로 현재 상태를 보여 준다. (③은 화면에서 재로그인/토큰 갱신)

-- 1) 버킷 : 공개 읽기 · 형식 제한 없음 · 50MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mes-attach', 'mes-attach', true, 52428800, null)
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = null;

-- 2) 정책 : 읽기 공개 · 올리기/바꾸기/지우기 = 로그인 사용자
drop policy if exists "mes_attach_read"   on storage.objects;
drop policy if exists "mes_attach_write"  on storage.objects;
drop policy if exists "mes_attach_update" on storage.objects;
drop policy if exists "mes_attach_delete" on storage.objects;

create policy "mes_attach_read" on storage.objects
  for select using (bucket_id = 'mes-attach');

create policy "mes_attach_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'mes-attach');

create policy "mes_attach_update" on storage.objects
  for update to authenticated using (bucket_id = 'mes-attach') with check (bucket_id = 'mes-attach');

create policy "mes_attach_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'mes-attach');

-- 3) 확인 : 버킷 설정과 정책 목록
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'mes-attach';
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'mes_attach%' order by policyname;
