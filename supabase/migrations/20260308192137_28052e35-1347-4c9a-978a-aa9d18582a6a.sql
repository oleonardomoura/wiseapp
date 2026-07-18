
-- Flashcard collections
CREATE TABLE public.flashcard_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL DEFAULT 'A1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collections are viewable by authenticated"
ON public.flashcard_collections FOR SELECT TO authenticated
USING (true);

-- Flashcards (belong to a collection)
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.flashcard_collections(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Flashcards are viewable by authenticated"
ON public.flashcards FOR SELECT TO authenticated
USING (true);

-- Per-user flashcard progress (SRS state)
CREATE TABLE public.flashcard_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  easiness_factor numeric NOT NULL DEFAULT 2.5,
  interval integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  total_reviews integer NOT NULL DEFAULT 0,
  correct_reviews integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, flashcard_id)
);

ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flashcard progress"
ON public.flashcard_progress FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcard progress"
ON public.flashcard_progress FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcard progress"
ON public.flashcard_progress FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_flashcard_progress_updated_at
  BEFORE UPDATE ON public.flashcard_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed collections and cards
INSERT INTO public.flashcard_collections (id, name, level) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Basic Greetings', 'A1'),
  ('a0000001-0000-0000-0000-000000000002', 'Daily Routines', 'A1'),
  ('a0000001-0000-0000-0000-000000000003', 'Common Verbs', 'A2');

INSERT INTO public.flashcards (collection_id, front, back) VALUES
  -- Basic Greetings
  ('a0000001-0000-0000-0000-000000000001', 'Hello', 'Olá'),
  ('a0000001-0000-0000-0000-000000000001', 'Good morning', 'Bom dia'),
  ('a0000001-0000-0000-0000-000000000001', 'Good afternoon', 'Boa tarde'),
  ('a0000001-0000-0000-0000-000000000001', 'Good evening', 'Boa noite'),
  ('a0000001-0000-0000-0000-000000000001', 'Nice to meet you', 'Prazer em conhecê-lo'),
  -- Daily Routines
  ('a0000001-0000-0000-0000-000000000002', 'I wake up at 7am', 'Eu acordo às 7h'),
  ('a0000001-0000-0000-0000-000000000002', 'I brush my teeth', 'Eu escovo os dentes'),
  ('a0000001-0000-0000-0000-000000000002', 'I have breakfast', 'Eu tomo café da manhã'),
  ('a0000001-0000-0000-0000-000000000002', 'I go to work', 'Eu vou trabalhar'),
  ('a0000001-0000-0000-0000-000000000002', 'I go to bed', 'Eu vou dormir'),
  -- Common Verbs
  ('a0000001-0000-0000-0000-000000000003', 'To eat', 'Comer'),
  ('a0000001-0000-0000-0000-000000000003', 'To drink', 'Beber'),
  ('a0000001-0000-0000-0000-000000000003', 'To read', 'Ler'),
  ('a0000001-0000-0000-0000-000000000003', 'To write', 'Escrever'),
  ('a0000001-0000-0000-0000-000000000003', 'To speak', 'Falar');
