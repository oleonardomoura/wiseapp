-- ============================================================================
-- Admin content visibility targeting: when an admin creates a material,
-- course module, flashcard collection, or audio text, they can choose to
-- show it to specific classes, or to every class of a given level, instead
-- of (or in addition to) a single owning class.
-- ============================================================================

create table if not exists public.content_class_targets (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('material', 'course', 'flashcards', 'audio_text')),
  content_id text not null,
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (content_type, content_id, class_id)
);

create table if not exists public.content_level_targets (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('material', 'course', 'flashcards', 'audio_text')),
  content_id text not null,
  level text not null,
  created_at timestamptz not null default now(),
  unique (content_type, content_id, level)
);

create index if not exists idx_content_class_targets_lookup on public.content_class_targets(content_type, content_id);
create index if not exists idx_content_class_targets_class_id on public.content_class_targets(class_id);
create index if not exists idx_content_level_targets_lookup on public.content_level_targets(content_type, content_id);

alter table public.content_class_targets enable row level security;
alter table public.content_level_targets enable row level security;

drop policy if exists "Admin can view content class targets" on public.content_class_targets;
create policy "Admin can view content class targets"
on public.content_class_targets for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage content class targets" on public.content_class_targets;
create policy "Admin can manage content class targets"
on public.content_class_targets for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can view content level targets" on public.content_level_targets;
create policy "Admin can view content level targets"
on public.content_level_targets for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin can manage content level targets" on public.content_level_targets;
create policy "Admin can manage content level targets"
on public.content_level_targets for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Central visibility check, reused by every content table's SELECT policy.
--   _content_type    'material' | 'course' | 'flashcards' | 'audio_text'
--   _content_id      the content row's own id, as text
--   _owner_class_id  the content row's own class_id column (nullable)
--
-- Visible when: admin; OR no owner class and no explicit targets (legacy
-- global content); OR the caller owns/is enrolled in the owning class; OR
-- the caller owns/is enrolled in a class that was explicitly targeted
-- (by class or by matching level).
-- ============================================================================
create or replace function public.content_is_visible(_content_type text, _content_id text, _owner_class_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return true;
  end if;

  if _owner_class_id is null
     and not exists (select 1 from public.content_class_targets where content_type = _content_type and content_id = _content_id)
     and not exists (select 1 from public.content_level_targets where content_type = _content_type and content_id = _content_id)
  then
    return true;
  end if;

  if _owner_class_id is not null and (
    exists (select 1 from public.teacher_classes tc where tc.id = _owner_class_id and tc.teacher_id = auth.uid())
    or exists (select 1 from public.class_enrollments ce where ce.class_id = _owner_class_id and ce.student_id = auth.uid())
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = auth.uid()
      and (
        exists (select 1 from public.content_class_targets t where t.content_type = _content_type and t.content_id = _content_id and t.class_id = tc.id)
        or exists (select 1 from public.content_level_targets t where t.content_type = _content_type and t.content_id = _content_id and t.level = tc.level)
      )
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.class_enrollments ce
    join public.teacher_classes tc on tc.id = ce.class_id
    where ce.student_id = auth.uid()
      and (
        exists (select 1 from public.content_class_targets t where t.content_type = _content_type and t.content_id = _content_id and t.class_id = ce.class_id)
        or exists (select 1 from public.content_level_targets t where t.content_type = _content_type and t.content_id = _content_id and t.level = tc.level)
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- ============================================================================
-- class_materials: allow targeting (class_id becomes optional).
-- ============================================================================
alter table public.class_materials alter column class_id drop not null;

drop policy if exists "View materials of own/enrolled/admin classes" on public.class_materials;
create policy "View materials of own/enrolled/admin classes"
on public.class_materials for select to authenticated
using (public.content_is_visible('material', id::text, class_id));

-- Storage RLS still requires a class folder per file, so uploads for
-- multi-target materials use the first target class as the storage owner;
-- access to the file itself is still governed by teacher/admin/enrollment
-- checks already in place for storage.objects, which is fine since anyone
-- who can see the row can be granted read via the existing per-class rule
-- only when class_id is set. For null-class_id (targeted) materials we also
-- allow read when the caller can see the row through content_is_visible.
drop policy if exists "View class material files" on storage.objects;
create policy "View class material files"
on storage.objects for select to authenticated
using (
  bucket_id = 'class-materials'
  and (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teacher_classes tc
      where tc.id::text = (storage.foldername(name))[1] and tc.teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.class_enrollments ce
      where ce.class_id::text = (storage.foldername(name))[1] and ce.student_id = auth.uid()
    )
    or exists (
      select 1 from public.class_materials m
      where m.file_url = name
        and public.content_is_visible('material', m.id::text, m.class_id)
    )
  )
);

-- ============================================================================
-- course_modules (top-level) / course_lessons, oral_practice_items,
-- consolidation_items (children -> derive visibility from their module).
-- ============================================================================
drop policy if exists "View course modules" on public.course_modules;
create policy "View course modules"
on public.course_modules for select to authenticated
using (public.content_is_visible('course', id::text, class_id));

drop policy if exists "View course lessons" on public.course_lessons;
create policy "View course lessons"
on public.course_lessons for select to authenticated
using (
  exists (
    select 1 from public.course_modules m
    where m.id = course_lessons.module_id
      and public.content_is_visible('course', m.id::text, m.class_id)
  )
);

drop policy if exists "View oral practice items" on public.oral_practice_items;
create policy "View oral practice items"
on public.oral_practice_items for select to authenticated
using (
  exists (
    select 1 from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = oral_practice_items.lesson_id
      and public.content_is_visible('course', m.id::text, m.class_id)
  )
);

drop policy if exists "View consolidation items" on public.consolidation_items;
create policy "View consolidation items"
on public.consolidation_items for select to authenticated
using (
  exists (
    select 1 from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where l.id = consolidation_items.lesson_id
      and public.content_is_visible('course', m.id::text, m.class_id)
  )
);

-- ============================================================================
-- flashcard_collections (top-level) / flashcards (child).
-- ============================================================================
drop policy if exists "View flashcard collections" on public.flashcard_collections;
create policy "View flashcard collections"
on public.flashcard_collections for select to authenticated
using (public.content_is_visible('flashcards', id::text, class_id));

drop policy if exists "View flashcards" on public.flashcards;
create policy "View flashcards"
on public.flashcards for select to authenticated
using (
  exists (
    select 1 from public.flashcard_collections fc
    where fc.id = flashcards.collection_id
      and public.content_is_visible('flashcards', fc.id::text, fc.class_id)
  )
);

-- ============================================================================
-- audio_texts (top-level) / sentences, vocabulary, phrases, tips (children).
-- ============================================================================
drop policy if exists "View audio texts" on public.audio_texts;
create policy "View audio texts"
on public.audio_texts for select to authenticated
using (public.content_is_visible('audio_text', id::text, class_id));

drop policy if exists "View audio text sentences" on public.audio_text_sentences;
create policy "View audio text sentences"
on public.audio_text_sentences for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_sentences.text_id
      and public.content_is_visible('audio_text', at.id::text, at.class_id)
  )
);

drop policy if exists "View audio text vocabulary" on public.audio_text_vocabulary;
create policy "View audio text vocabulary"
on public.audio_text_vocabulary for select to authenticated
using (
  exists (
    select 1 from public.audio_text_sentences s
    join public.audio_texts at on at.id = s.text_id
    where s.id = audio_text_vocabulary.sentence_id
      and public.content_is_visible('audio_text', at.id::text, at.class_id)
  )
);

drop policy if exists "View audio text phrases" on public.audio_text_phrases;
create policy "View audio text phrases"
on public.audio_text_phrases for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_phrases.text_id
      and public.content_is_visible('audio_text', at.id::text, at.class_id)
  )
);

drop policy if exists "View audio text tips" on public.audio_text_tips;
create policy "View audio text tips"
on public.audio_text_tips for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_tips.text_id
      and public.content_is_visible('audio_text', at.id::text, at.class_id)
  )
);
