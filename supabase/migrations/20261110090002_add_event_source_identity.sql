alter table public.events
  add column source_provider text,
  add column source_event_id text,
  add constraint events_source_identity_pair
    check ((source_provider is null) = (source_event_id is null)),
  add constraint events_source_identity_unique
    unique (source_provider, source_event_id);
