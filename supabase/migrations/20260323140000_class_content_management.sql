-- ============================================================================
-- Class content management: materials (PDF/video), course content
-- (modules/lessons/oral practice/consolidation), and class-scoped
-- flashcards/audio texts. Teachers manage only their own teacher_classes;
-- admin manages everything.
-- ============================================================================

-- ── class_materials (PDF / video uploaded by teacher or admin) ──
create table if not exists public.class_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.teacher_classes(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('pdf', 'video')),
  file_url text not null,
  file_size bigint,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_materials_class_id on public.class_materials(class_id);

drop trigger if exists update_class_materials_updated_at on public.class_materials;
create trigger update_class_materials_updated_at
before update on public.class_materials
for each row execute function public.update_updated_at_column();

alter table public.class_materials enable row level security;

drop policy if exists "View materials of own/enrolled/admin classes" on public.class_materials;
create policy "View materials of own/enrolled/admin classes"
on public.class_materials for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.teacher_classes tc
    where tc.id = class_materials.class_id and tc.teacher_id = auth.uid()
  )
  or exists (
    select 1 from public.class_enrollments ce
    where ce.class_id = class_materials.class_id and ce.student_id = auth.uid()
  )
);

drop policy if exists "Teachers/Admin can manage materials" on public.class_materials;
create policy "Teachers/Admin can manage materials"
on public.class_materials for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.teacher_classes tc
    where tc.id = class_materials.class_id and tc.teacher_id = auth.uid()
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.teacher_classes tc
    where tc.id = class_materials.class_id and tc.teacher_id = auth.uid()
  )
);

-- ── Storage bucket for materials (private; access via RLS on storage.objects) ──
insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', false)
on conflict (id) do nothing;

-- Objects are stored under `{class_id}/{filename}` so the first path segment
-- identifies the owning class.
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
  )
);

drop policy if exists "Teachers/Admin can upload class material files" on storage.objects;
create policy "Teachers/Admin can upload class material files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'class-materials'
  and (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teacher_classes tc
      where tc.id::text = (storage.foldername(name))[1] and tc.teacher_id = auth.uid()
    )
  )
);

drop policy if exists "Teachers/Admin can delete class material files" on storage.objects;
create policy "Teachers/Admin can delete class material files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'class-materials'
  and (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.teacher_classes tc
      where tc.id::text = (storage.foldername(name))[1] and tc.teacher_id = auth.uid()
    )
  )
);

-- ============================================================================
-- Course content: modules, lessons, oral practice, consolidation.
-- class_id null = legacy/global content (visible to every student, as today).
-- class_id set = content scoped to that teacher's class.
-- ============================================================================

create table if not exists public.course_modules (
  id integer primary key,
  class_id uuid references public.teacher_classes(id) on delete cascade,
  title text not null,
  level text not null default 'A1',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.course_lessons (
  id integer primary key,
  module_id integer not null references public.course_modules(id) on delete cascade,
  class_id uuid references public.teacher_classes(id) on delete cascade,
  title text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.oral_practice_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id integer not null references public.course_lessons(id) on delete cascade,
  class_id uuid references public.teacher_classes(id) on delete cascade,
  phrase text not null,
  translation text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.consolidation_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id integer not null references public.course_lessons(id) on delete cascade,
  class_id uuid references public.teacher_classes(id) on delete cascade,
  prompt text not null,
  answer text not null,
  acceptable text[] not null default '{}',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_modules_class_id on public.course_modules(class_id);
create index if not exists idx_course_lessons_module_id on public.course_lessons(module_id);
create index if not exists idx_course_lessons_class_id on public.course_lessons(class_id);
create index if not exists idx_oral_practice_items_lesson_id on public.oral_practice_items(lesson_id);
create index if not exists idx_consolidation_items_lesson_id on public.consolidation_items(lesson_id);

alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.oral_practice_items enable row level security;
alter table public.consolidation_items enable row level security;

-- SELECT: legacy global content (class_id is null) viewable by everyone;
-- class-scoped content viewable by its teacher, its enrolled students, and admin.
drop policy if exists "View course modules" on public.course_modules;
create policy "View course modules"
on public.course_modules for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = course_modules.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = course_modules.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage course modules" on public.course_modules;
create policy "Teachers/Admin can manage course modules"
on public.course_modules for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = course_modules.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = course_modules.class_id and tc.teacher_id = auth.uid()))
);

drop policy if exists "View course lessons" on public.course_lessons;
create policy "View course lessons"
on public.course_lessons for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = course_lessons.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = course_lessons.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage course lessons" on public.course_lessons;
create policy "Teachers/Admin can manage course lessons"
on public.course_lessons for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = course_lessons.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = course_lessons.class_id and tc.teacher_id = auth.uid()))
);

drop policy if exists "View oral practice items" on public.oral_practice_items;
create policy "View oral practice items"
on public.oral_practice_items for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = oral_practice_items.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = oral_practice_items.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage oral practice items" on public.oral_practice_items;
create policy "Teachers/Admin can manage oral practice items"
on public.oral_practice_items for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = oral_practice_items.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = oral_practice_items.class_id and tc.teacher_id = auth.uid()))
);

drop policy if exists "View consolidation items" on public.consolidation_items;
create policy "View consolidation items"
on public.consolidation_items for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = consolidation_items.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = consolidation_items.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage consolidation items" on public.consolidation_items;
create policy "Teachers/Admin can manage consolidation items"
on public.consolidation_items for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = consolidation_items.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = consolidation_items.class_id and tc.teacher_id = auth.uid()))
);

-- Seed course_modules/course_lessons/oral_practice_items/consolidation_items with
-- today's static content (src/data/course-exercises.ts + CoursePage.tsx
-- moduleDefinitions) so course_progress keeps referencing valid ids.
insert into public.course_modules (id, class_id, title, level, "order") values
  (1, null, 'Basic Greetings and Introductions', 'A1', 1),
  (2, null, 'Everyday Vocabulary', 'A1', 2),
  (3, null, 'Essential Grammar', 'A2', 3),
  (4, null, 'Conversation Skills', 'A2', 4),
  (5, null, 'Reading & Comprehension', 'B1', 5)
on conflict (id) do nothing;

insert into public.course_lessons (id, module_id, class_id, title, "order") values
  (1, 1, null, 'Hello and Basic Greetings', 1),
  (2, 1, null, 'Introducing Yourself', 2),
  (3, 1, null, 'Asking About Others', 3),
  (4, 1, null, 'Common Courtesy Phrases', 4),
  (5, 2, null, 'Numbers and Counting', 1),
  (6, 2, null, 'Days, Months & Seasons', 2),
  (7, 2, null, 'Colors and Shapes', 3),
  (8, 2, null, 'Food and Drinks', 4),
  (9, 3, null, 'Present Simple Tense', 1),
  (10, 3, null, 'Articles: A, An, The', 2),
  (11, 3, null, 'Plural Nouns', 3),
  (12, 3, null, 'Subject Pronouns', 4),
  (13, 3, null, 'Simple Questions', 5),
  (14, 4, null, 'At the Restaurant', 1),
  (15, 4, null, 'Asking for Directions', 2),
  (16, 4, null, 'Shopping Dialogues', 3),
  (17, 4, null, 'Making Plans', 4),
  (18, 5, null, 'Short Stories', 1),
  (19, 5, null, 'News Articles', 2),
  (20, 5, null, 'Email Writing', 3),
  (21, 5, null, 'Blog Posts', 4)
on conflict (id) do nothing;

insert into public.oral_practice_items (lesson_id, class_id, phrase, translation, "order") values
  (1, null, 'Hello, how are you?', 'Olá, como você está?', 1),
  (1, null, 'Good morning, nice to meet you.', 'Bom dia, prazer em conhecê-lo.', 2),
  (1, null, 'Hi, my name is John.', 'Oi, meu nome é John.', 3),
  (1, null, 'Good evening, how is it going?', 'Boa noite, como vai?', 4),
  (2, null, 'My name is Maria and I am from Brazil.', 'Meu nome é Maria e eu sou do Brasil.', 1),
  (2, null, 'I am twenty-five years old.', 'Eu tenho vinte e cinco anos.', 2),
  (2, null, 'I live in São Paulo.', 'Eu moro em São Paulo.', 3),
  (2, null, 'I am a student.', 'Eu sou estudante.', 4),
  (2, null, 'What is your name?', 'Qual é o seu nome?', 5),
  (3, null, 'Where are you from?', 'De onde você é?', 1),
  (3, null, 'What do you do for a living?', 'O que você faz da vida?', 2),
  (3, null, 'How old are you?', 'Quantos anos você tem?', 3),
  (3, null, 'Do you have any siblings?', 'Você tem irmãos?', 4),
  (4, null, 'Please and thank you.', 'Por favor e obrigado.', 1),
  (4, null, 'Excuse me, can you help me?', 'Com licença, você pode me ajudar?', 2),
  (4, null, 'I am sorry.', 'Eu sinto muito.', 3),
  (4, null, 'You are welcome.', 'De nada.', 4);

insert into public.consolidation_items (lesson_id, class_id, prompt, answer, acceptable, "order") values
  (1, null, 'Olá, como você está?', 'Hello, how are you?', array['Hi, how are you?', 'Hey, how are you?'], 1),
  (1, null, 'Bom dia!', 'Good morning!', array['Good morning'], 2),
  (1, null, 'Prazer em conhecê-lo.', 'Nice to meet you.', array['Nice to meet you', 'Pleased to meet you.', 'Pleased to meet you'], 3),
  (1, null, 'Boa noite!', 'Good evening!', array['Good evening', 'Good night!'], 4),
  (2, null, 'Meu nome é Ana.', 'My name is Ana.', array['I am Ana.', 'I''m Ana.'], 1),
  (2, null, 'Eu sou do Brasil.', 'I am from Brazil.', array['I''m from Brazil.'], 2),
  (2, null, 'Eu tenho 20 anos.', 'I am twenty years old.', array['I''m twenty years old.', 'I am 20 years old.', 'I''m 20 years old.'], 3),
  (2, null, 'Qual é o seu nome?', 'What is your name?', array['What''s your name?'], 4),
  (2, null, 'Eu sou estudante.', 'I am a student.', array['I''m a student.'], 5),
  (3, null, 'De onde você é?', 'Where are you from?', array['Where do you come from?'], 1),
  (3, null, 'O que você faz da vida?', 'What do you do for a living?', array['What do you do?', 'What is your job?'], 2),
  (3, null, 'Quantos anos você tem?', 'How old are you?', array[]::text[], 3),
  (3, null, 'Você tem irmãos?', 'Do you have any siblings?', array['Do you have brothers or sisters?', 'Do you have any brothers or sisters?'], 4),
  (4, null, 'Por favor.', 'Please.', array['Please'], 1),
  (4, null, 'Obrigado.', 'Thank you.', array['Thank you', 'Thanks.', 'Thanks'], 2),
  (4, null, 'Com licença.', 'Excuse me.', array['Excuse me', 'Pardon me.'], 3),
  (4, null, 'De nada.', 'You are welcome.', array['You''re welcome.', 'You''re welcome', 'No problem.', 'No problem'], 4);

-- NOTE: no FK is added from course_progress to course_modules/course_lessons.
-- Existing course_progress rows in production use a different module/lesson
-- numbering (8 modules x 3 lessons = ids 1-24) than the current CoursePage.tsx
-- source (5 modules, ids 1-21). This drift must be reconciled when the
-- frontend is rewired to read course content from the database.

-- ============================================================================
-- Class-scoped flashcards and audio texts.
-- class_id null = legacy/global content (kept exactly as before).
-- class_id set = content scoped to that teacher's class.
-- ============================================================================

alter table public.flashcard_collections add column if not exists class_id uuid references public.teacher_classes(id) on delete cascade;
alter table public.audio_texts add column if not exists class_id uuid references public.teacher_classes(id) on delete cascade;

create index if not exists idx_flashcard_collections_class_id on public.flashcard_collections(class_id);
create index if not exists idx_audio_texts_class_id on public.audio_texts(class_id);

drop policy if exists "Collections are viewable by authenticated" on public.flashcard_collections;
create policy "View flashcard collections"
on public.flashcard_collections for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = flashcard_collections.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = flashcard_collections.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage flashcard collections" on public.flashcard_collections;
create policy "Teachers/Admin can manage flashcard collections"
on public.flashcard_collections for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = flashcard_collections.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = flashcard_collections.class_id and tc.teacher_id = auth.uid()))
);

drop policy if exists "Flashcards are viewable by authenticated" on public.flashcards;
create policy "View flashcards"
on public.flashcards for select to authenticated
using (
  exists (
    select 1 from public.flashcard_collections fc
    where fc.id = flashcards.collection_id
      and (
        fc.class_id is null
        or public.has_role(auth.uid(), 'admin')
        or exists (select 1 from public.teacher_classes tc where tc.id = fc.class_id and tc.teacher_id = auth.uid())
        or exists (select 1 from public.class_enrollments ce where ce.class_id = fc.class_id and ce.student_id = auth.uid())
      )
  )
);

drop policy if exists "Teachers/Admin can manage flashcards" on public.flashcards;
create policy "Teachers/Admin can manage flashcards"
on public.flashcards for all to authenticated
using (
  exists (
    select 1 from public.flashcard_collections fc
    where fc.id = flashcards.collection_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (fc.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = fc.class_id and tc.teacher_id = auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.flashcard_collections fc
    where fc.id = flashcards.collection_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (fc.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = fc.class_id and tc.teacher_id = auth.uid()))
      )
  )
);

drop policy if exists "Audio texts viewable by authenticated" on public.audio_texts;
create policy "View audio texts"
on public.audio_texts for select to authenticated
using (
  class_id is null
  or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.teacher_classes tc where tc.id = audio_texts.class_id and tc.teacher_id = auth.uid())
  or exists (select 1 from public.class_enrollments ce where ce.class_id = audio_texts.class_id and ce.student_id = auth.uid())
);

drop policy if exists "Teachers/Admin can manage audio texts" on public.audio_texts;
create policy "Teachers/Admin can manage audio texts"
on public.audio_texts for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = audio_texts.class_id and tc.teacher_id = auth.uid()))
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = audio_texts.class_id and tc.teacher_id = auth.uid()))
);

drop policy if exists "Sentences viewable by authenticated" on public.audio_text_sentences;
create policy "View audio text sentences"
on public.audio_text_sentences for select to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_sentences.text_id
      and (
        at.class_id is null
        or public.has_role(auth.uid(), 'admin')
        or exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid())
        or exists (select 1 from public.class_enrollments ce where ce.class_id = at.class_id and ce.student_id = auth.uid())
      )
  )
);

drop policy if exists "Teachers/Admin can manage audio text sentences" on public.audio_text_sentences;
create policy "Teachers/Admin can manage audio text sentences"
on public.audio_text_sentences for all to authenticated
using (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_sentences.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.audio_texts at
    where at.id = audio_text_sentences.text_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
);

drop policy if exists "Vocabulary viewable by authenticated" on public.audio_text_vocabulary;
create policy "View audio text vocabulary"
on public.audio_text_vocabulary for select to authenticated
using (
  exists (
    select 1 from public.audio_text_sentences s
    join public.audio_texts at on at.id = s.text_id
    where s.id = audio_text_vocabulary.sentence_id
      and (
        at.class_id is null
        or public.has_role(auth.uid(), 'admin')
        or exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid())
        or exists (select 1 from public.class_enrollments ce where ce.class_id = at.class_id and ce.student_id = auth.uid())
      )
  )
);

drop policy if exists "Teachers/Admin can manage audio text vocabulary" on public.audio_text_vocabulary;
create policy "Teachers/Admin can manage audio text vocabulary"
on public.audio_text_vocabulary for all to authenticated
using (
  exists (
    select 1 from public.audio_text_sentences s
    join public.audio_texts at on at.id = s.text_id
    where s.id = audio_text_vocabulary.sentence_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
)
with check (
  exists (
    select 1 from public.audio_text_sentences s
    join public.audio_texts at on at.id = s.text_id
    where s.id = audio_text_vocabulary.sentence_id
      and (
        public.has_role(auth.uid(), 'admin')
        or (at.class_id is not null and exists (select 1 from public.teacher_classes tc where tc.id = at.class_id and tc.teacher_id = auth.uid()))
      )
  )
);
