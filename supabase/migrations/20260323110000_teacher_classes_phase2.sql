create table if not exists public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null default 'A1',
  description text,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index if not exists idx_teacher_classes_teacher_id on public.teacher_classes(teacher_id);
create index if not exists idx_class_enrollments_class_id on public.class_enrollments(class_id);
create index if not exists idx_class_enrollments_student_id on public.class_enrollments(student_id);

drop trigger if exists update_teacher_classes_updated_at on public.teacher_classes;
create trigger update_teacher_classes_updated_at
before update on public.teacher_classes
for each row execute function public.update_updated_at_column();

alter table public.teacher_classes enable row level security;
alter table public.class_enrollments enable row level security;

drop policy if exists "Teachers/Admin can view own classes" on public.teacher_classes;
create policy "Teachers/Admin can view own classes"
on public.teacher_classes for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid())
);

drop policy if exists "Teachers/Admin can create classes" on public.teacher_classes;
create policy "Teachers/Admin can create classes"
on public.teacher_classes for insert to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid())
);

drop policy if exists "Teachers/Admin can update classes" on public.teacher_classes;
create policy "Teachers/Admin can update classes"
on public.teacher_classes for update to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid())
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid())
);

drop policy if exists "Teachers/Admin can delete classes" on public.teacher_classes;
create policy "Teachers/Admin can delete classes"
on public.teacher_classes for delete to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid())
);

drop policy if exists "Students can view own enrollments" on public.class_enrollments;
create policy "Students can view own enrollments"
on public.class_enrollments for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Teachers/Admin can view class enrollments" on public.class_enrollments;
create policy "Teachers/Admin can view class enrollments"
on public.class_enrollments for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.teacher_classes tc
    where tc.id = class_enrollments.class_id
      and tc.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers/Admin can manage class enrollments" on public.class_enrollments;
create policy "Teachers/Admin can manage class enrollments"
on public.class_enrollments for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.teacher_classes tc
    where tc.id = class_enrollments.class_id
      and tc.teacher_id = auth.uid()
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.teacher_classes tc
    where tc.id = class_enrollments.class_id
      and tc.teacher_id = auth.uid()
  )
);

