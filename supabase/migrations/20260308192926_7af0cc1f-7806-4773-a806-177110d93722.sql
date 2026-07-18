
-- Table: audio_texts (library of texts)
CREATE TABLE public.audio_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_pt text NOT NULL,
  level text NOT NULL DEFAULT 'A1',
  theme text NOT NULL DEFAULT 'Daily Life',
  seq integer NOT NULL DEFAULT 1,
  duration text NOT NULL DEFAULT '1:30',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: audio_text_sentences (lines of each text)
CREATE TABLE public.audio_text_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES public.audio_texts(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 1,
  en text NOT NULL,
  pt text NOT NULL
);

-- Table: audio_text_vocabulary (highlighted words)
CREATE TABLE public.audio_text_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id uuid NOT NULL REFERENCES public.audio_text_sentences(id) ON DELETE CASCADE,
  word text NOT NULL,
  translation text NOT NULL,
  explanation text
);

-- Table: audio_sessions (user progress per text)
CREATE TABLE public.audio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  text_id uuid NOT NULL REFERENCES public.audio_texts(id) ON DELETE CASCADE,
  initial_score integer DEFAULT 0,
  final_score integer DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, text_id)
);

-- RLS
ALTER TABLE public.audio_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_text_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_text_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_sessions ENABLE ROW LEVEL SECURITY;

-- audio_texts: viewable by authenticated
CREATE POLICY "Audio texts viewable by authenticated" ON public.audio_texts FOR SELECT TO authenticated USING (true);

-- audio_text_sentences: viewable by authenticated
CREATE POLICY "Sentences viewable by authenticated" ON public.audio_text_sentences FOR SELECT TO authenticated USING (true);

-- audio_text_vocabulary: viewable by authenticated
CREATE POLICY "Vocabulary viewable by authenticated" ON public.audio_text_vocabulary FOR SELECT TO authenticated USING (true);

-- audio_sessions: user CRUD on own data
CREATE POLICY "Users can view own audio sessions" ON public.audio_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audio sessions" ON public.audio_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audio sessions" ON public.audio_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
