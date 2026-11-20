-- v375 : 수정요청게시판 새 글 → ntfy(HC_Smart) 알림
--   알림 설정은 mes_alert_rules 의 kind='mod_request' (알림등록 화면에서 켜고 끔·토픽 변경)
--   발송은 DB 가 직접 한다 (fn_alert_push → pg_net). 알림이 실패해도 글 저장은 막지 않는다.
insert into public.mes_alert_rules(kind,enabled,bell,ntfy,ntfy_server,ntfy_topic,recipients,params)
values ('mod_request',true,false,true,'https://ntfy.sh','HC_Smart',null,'{}'::jsonb)
on conflict (kind) do nothing;

create or replace function public.trg_mod_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.fn_alert_push(
      'mod_request',
      '[수정요청] ' || coalesce(nullif(trim(new.title),''),'(제목 없음)'),
      concat_ws(' · ', nullif(trim(new.requester),''), nullif(trim(coalesce(new.module,'')||' '||coalesce(new.screen,'')),''), nullif(trim(new.category),''), nullif(trim(new.priority),''))
        || case when coalesce(trim(new.content),'')<>'' then E'\n' || left(trim(new.content),300) else '' end,
      null, null, 'mod_request:' || new.req_id, 'memo');
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists trg_mod_request_notify on public.mod_requests;
create trigger trg_mod_request_notify after insert on public.mod_requests
for each row execute function public.trg_mod_request_notify();
