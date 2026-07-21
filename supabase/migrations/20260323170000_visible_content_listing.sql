-- Returns the ids of top-level content (of a given type) visible to a given
-- class: content owned by the class, legacy global content (no owner, no
-- explicit targets), content explicitly targeted at the class, or content
-- targeted at the class's level. Used by the content management screens to
-- list "what a class would see" instead of only its own owned rows.
create or replace function public.content_has_any_target(_content_type text, _content_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.content_class_targets where content_type = _content_type and content_id = _content_id)
      or exists (select 1 from public.content_level_targets where content_type = _content_type and content_id = _content_id)
$$;

create or replace function public.visible_content_ids(_content_type text, _class_id uuid)
returns table(content_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _level text;
  _authorized boolean;
begin
  _authorized := public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.teacher_classes tc where tc.id = _class_id and tc.teacher_id = auth.uid())
    or exists (select 1 from public.class_enrollments ce where ce.class_id = _class_id and ce.student_id = auth.uid());

  if not _authorized then
    return;
  end if;

  select tc.level into _level from public.teacher_classes tc where tc.id = _class_id;

  if _content_type = 'material' then
    return query
      select m.id::text from public.class_materials m
      where m.class_id = _class_id
         or (m.class_id is null and not public.content_has_any_target('material', m.id::text))
         or (m.class_id is null and exists (select 1 from public.content_class_targets t where t.content_type = 'material' and t.content_id = m.id::text and t.class_id = _class_id))
         or (m.class_id is null and exists (select 1 from public.content_level_targets t where t.content_type = 'material' and t.content_id = m.id::text and t.level = _level));
  elsif _content_type = 'course' then
    return query
      select mo.id::text from public.course_modules mo
      where mo.class_id = _class_id
         or (mo.class_id is null and not public.content_has_any_target('course', mo.id::text))
         or (mo.class_id is null and exists (select 1 from public.content_class_targets t where t.content_type = 'course' and t.content_id = mo.id::text and t.class_id = _class_id))
         or (mo.class_id is null and exists (select 1 from public.content_level_targets t where t.content_type = 'course' and t.content_id = mo.id::text and t.level = _level));
  elsif _content_type = 'flashcards' then
    return query
      select fc.id::text from public.flashcard_collections fc
      where fc.class_id = _class_id
         or (fc.class_id is null and not public.content_has_any_target('flashcards', fc.id::text))
         or (fc.class_id is null and exists (select 1 from public.content_class_targets t where t.content_type = 'flashcards' and t.content_id = fc.id::text and t.class_id = _class_id))
         or (fc.class_id is null and exists (select 1 from public.content_level_targets t where t.content_type = 'flashcards' and t.content_id = fc.id::text and t.level = _level));
  elsif _content_type = 'audio_text' then
    return query
      select "at".id::text from public.audio_texts "at"
      where "at".class_id = _class_id
         or ("at".class_id is null and not public.content_has_any_target('audio_text', "at".id::text))
         or ("at".class_id is null and exists (select 1 from public.content_class_targets t where t.content_type = 'audio_text' and t.content_id = "at".id::text and t.class_id = _class_id))
         or ("at".class_id is null and exists (select 1 from public.content_level_targets t where t.content_type = 'audio_text' and t.content_id = "at".id::text and t.level = _level));
  end if;
end;
$$;
