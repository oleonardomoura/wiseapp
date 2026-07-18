alter table public.live_sessions
  add column if not exists class_id uuid references public.teacher_classes(id) on delete set null;

alter table public.conversation_groups
  add column if not exists class_id uuid references public.teacher_classes(id) on delete set null;

create table if not exists public.class_notifications (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_class_notifications_class_id on public.class_notifications(class_id);
create index if not exists idx_class_notifications_teacher_id on public.class_notifications(teacher_id);

alter table public.class_notifications enable row level security;

drop policy if exists "Teachers/Admin can manage class notifications" on public.class_notifications;
create policy "Teachers/Admin can manage class notifications"
on public.class_notifications
for all
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.teacher_classes tc
      where tc.id = class_notifications.class_id
        and tc.teacher_id = auth.uid()
    )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and exists (
      select 1
      from public.teacher_classes tc
      where tc.id = class_notifications.class_id
        and tc.teacher_id = auth.uid()
    )
    and teacher_id = auth.uid()
  )
);

drop policy if exists "Students can view class notifications" on public.class_notifications;
create policy "Students can view class notifications"
on public.class_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.class_enrollments ce
    where ce.class_id = class_notifications.class_id
      and ce.student_id = auth.uid()
  )
);

drop policy if exists "Teachers can manage live sessions" on public.live_sessions;
create policy "Teachers can manage live sessions"
on public.live_sessions
for all
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and (
      host_id = auth.uid()
      or exists (
        select 1
        from public.teacher_classes tc
        where tc.id = live_sessions.class_id
          and tc.teacher_id = auth.uid()
      )
    )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and (
      host_id = auth.uid()
      or exists (
        select 1
        from public.teacher_classes tc
        where tc.id = live_sessions.class_id
          and tc.teacher_id = auth.uid()
      )
    )
  )
);

drop policy if exists "Teachers/admins can manage groups" on public.conversation_groups;
create policy "Teachers/admins can manage groups"
on public.conversation_groups
for all
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and (
      teacher_id = auth.uid()
      or exists (
        select 1
        from public.teacher_classes tc
        where tc.id = conversation_groups.class_id
          and tc.teacher_id = auth.uid()
      )
    )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'teacher')
    and (
      teacher_id = auth.uid()
      or exists (
        select 1
        from public.teacher_classes tc
        where tc.id = conversation_groups.class_id
          and tc.teacher_id = auth.uid()
      )
    )
  )
);

