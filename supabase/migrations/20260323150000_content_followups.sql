-- course_modules/course_lessons were seeded with explicit ids (1-5 / 1-21) and
-- have no default, so new rows created from the UI need an id assigned by a
-- sequence continuing after the seeded values.
create sequence if not exists public.course_modules_id_seq owned by public.course_modules.id;
select setval('public.course_modules_id_seq', (select coalesce(max(id), 0) from public.course_modules));
alter table public.course_modules alter column id set default nextval('public.course_modules_id_seq');

create sequence if not exists public.course_lessons_id_seq owned by public.course_lessons.id;
select setval('public.course_lessons_id_seq', (select coalesce(max(id), 0) from public.course_lessons));
alter table public.course_lessons alter column id set default nextval('public.course_lessons_id_seq');

-- audio_text_phrases / audio_text_tips exist in the live DB (created outside
-- migrations) with RLS enabled but only implicit policies. Add the same
-- read/write pattern used for audio_text_sentences.
drop policy if exists "Phrases viewable by authenticated" on public.audio_text_phrases;
drop policy if exists "View audio text phrases" on public.audio_text_phrases;
create policy "View audio text phrases"
on public.audio_text_phrases for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_phrases.text_id
      and (
        at.class_id is null
        or public.has_role(auth.uid(), 'admin')
        or exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid())
        or exists (select 1 from public.class_enrollments ce where ce.class_id = at.class_id and ce.student_id = auth.uid())
      )
  )
);

drop policy if exists "Teachers/Admin can manage audio text phrases" on public.audio_text_phrases;
create policy "Teachers/Admin can manage audio text phrases"
on public.audio_text_phrases for all to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_phrases.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_phrases.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
);

drop policy if exists "Tips viewable by authenticated" on public.audio_text_tips;
drop policy if exists "View audio text tips" on public.audio_text_tips;
create policy "View audio text tips"
on public.audio_text_tips for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_tips.text_id
      and (
        at.class_id is null
        or public.has_role(auth.uid(), 'admin')
        or exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid())
        or exists (select 1 from public.class_enrollments ce where ce.class_id = at.class_id and ce.student_id = auth.uid())
      )
  )
);

drop policy if exists "Teachers/Admin can manage audio text tips" on public.audio_text_tips;
create policy "Teachers/Admin can manage audio text tips"
on public.audio_text_tips for all to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_tips.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_tips.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
);
