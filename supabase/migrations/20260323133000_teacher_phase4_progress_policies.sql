drop policy if exists "Teachers can view class course progress" on public.course_progress;
create policy "Teachers can view class course progress"
on public.course_progress
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = course_progress.user_id
        and tc.teacher_id = auth.uid()
    )
  )
);

drop policy if exists "Teachers can view class flashcard progress" on public.flashcard_progress;
create policy "Teachers can view class flashcard progress"
on public.flashcard_progress
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = flashcard_progress.user_id
        and tc.teacher_id = auth.uid()
    )
  )
);

drop policy if exists "Teachers can view class audio sessions" on public.audio_sessions;
create policy "Teachers can view class audio sessions"
on public.audio_sessions
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = audio_sessions.user_id
        and tc.teacher_id = auth.uid()
    )
  )
);

drop policy if exists "Teachers can view class achievements" on public.user_achievements;
create policy "Teachers can view class achievements"
on public.user_achievements
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = user_achievements.user_id
        and tc.teacher_id = auth.uid()
    )
  )
);

