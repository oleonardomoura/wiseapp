
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  cefr_level TEXT DEFAULT 'A1' CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles table (separate from profiles per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Auto-create profile + student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Posts table (Community)
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Posts are viewable by authenticated users"
  ON public.posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create posts"
  ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated"
  ON public.comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create comments"
  ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Post likes table
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by authenticated"
  ON public.post_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Table to persist course progress per user per lesson
CREATE TABLE public.course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id integer NOT NULL,
  lesson_id integer NOT NULL,
  oral_practice_completed boolean NOT NULL DEFAULT false,
  consolidation_completed boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own course progress"
ON public.course_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own course progress"
ON public.course_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own course progress"
ON public.course_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_course_progress_updated_at
  BEFORE UPDATE ON public.course_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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

INSERT INTO public.flashcard_collections (id, name, level) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Basic Greetings', 'A1'),
  ('a0000001-0000-0000-0000-000000000002', 'Daily Routines', 'A1'),
  ('a0000001-0000-0000-0000-000000000003', 'Common Verbs', 'A2');

INSERT INTO public.flashcards (collection_id, front, back) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Hello', 'Olá'),
  ('a0000001-0000-0000-0000-000000000001', 'Good morning', 'Bom dia'),
  ('a0000001-0000-0000-0000-000000000001', 'Good afternoon', 'Boa tarde'),
  ('a0000001-0000-0000-0000-000000000001', 'Good evening', 'Boa noite'),
  ('a0000001-0000-0000-0000-000000000001', 'Nice to meet you', 'Prazer em conhecê-lo'),
  ('a0000001-0000-0000-0000-000000000002', 'I wake up at 7am', 'Eu acordo às 7h'),
  ('a0000001-0000-0000-0000-000000000002', 'I brush my teeth', 'Eu escovo os dentes'),
  ('a0000001-0000-0000-0000-000000000002', 'I have breakfast', 'Eu tomo café da manhã'),
  ('a0000001-0000-0000-0000-000000000002', 'I go to work', 'Eu vou trabalhar'),
  ('a0000001-0000-0000-0000-000000000002', 'I go to bed', 'Eu vou dormir'),
  ('a0000001-0000-0000-0000-000000000003', 'To eat', 'Comer'),
  ('a0000001-0000-0000-0000-000000000003', 'To drink', 'Beber'),
  ('a0000001-0000-0000-0000-000000000003', 'To read', 'Ler'),
  ('a0000001-0000-0000-0000-000000000003', 'To write', 'Escrever'),
  ('a0000001-0000-0000-0000-000000000003', 'To speak', 'Falar');

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

ALTER TABLE public.audio_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_text_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_text_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audio texts viewable by authenticated" ON public.audio_texts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sentences viewable by authenticated" ON public.audio_text_sentences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vocabulary viewable by authenticated" ON public.audio_text_vocabulary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view own audio sessions" ON public.audio_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audio sessions" ON public.audio_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audio sessions" ON public.audio_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Table for scheduled/live sessions
CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  host_id uuid NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  max_participants integer DEFAULT 30,
  meeting_url text,
  level text DEFAULT 'A1',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.live_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

CREATE TABLE public.recorded_lives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  host_id uuid NOT NULL,
  video_url text,
  thumbnail_url text,
  duration text DEFAULT '0:00',
  views integer DEFAULT 0,
  level text DEFAULT 'A1',
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live sessions viewable by authenticated" ON public.live_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage live sessions" ON public.live_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.live_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own registrations" ON public.live_registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can register for lives" ON public.live_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unregister from lives" ON public.live_registrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.recorded_lives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recorded lives viewable by authenticated" ON public.recorded_lives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage recorded lives" ON public.recorded_lives FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;

INSERT INTO public.live_sessions (title, description, host_id, scheduled_at, duration_minutes, status, level) VALUES
  ('Conversação Livre - Nível A2', 'Pratique conversação em inglês com outros alunos do nível A2', '00000000-0000-0000-0000-000000000000', now() + interval '2 hours', 60, 'upcoming', 'A2'),
  ('Grammar Hour: Past Perfect', 'Domine o Past Perfect com exercícios práticos', '00000000-0000-0000-0000-000000000000', now() + interval '1 day', 45, 'upcoming', 'B1'),
  ('Pronunciation Workshop', 'Workshop de pronúncia focado em sons difíceis', '00000000-0000-0000-0000-000000000000', now() + interval '3 days', 50, 'upcoming', 'A2'),
  ('Movie Discussion: Inception', 'Discuta o filme Inception em inglês', '00000000-0000-0000-0000-000000000000', now() + interval '5 days', 60, 'upcoming', 'B2');

INSERT INTO public.recorded_lives (title, host_id, duration, views, level, created_at) VALUES
  ('Phrasal Verbs Essenciais', '00000000-0000-0000-0000-000000000000', '45 min', 128, 'B1', now() - interval '7 days'),
  ('Pronúncia: Sons Difíceis', '00000000-0000-0000-0000-000000000000', '38 min', 95, 'A2', now() - interval '11 days'),
  ('Business English: Meetings', '00000000-0000-0000-0000-000000000000', '52 min', 210, 'B2', now() - interval '16 days'),
  ('Listening Practice: Songs', '00000000-0000-0000-0000-000000000000', '40 min', 175, 'A1', now() - interval '21 days'),
  ('Conversation: Travel Tips', '00000000-0000-0000-0000-000000000000', '35 min', 88, 'A2', now() - interval '26 days'),
  ('Grammar: Conditionals', '00000000-0000-0000-0000-000000000000', '48 min', 152, 'B1', now() - interval '31 days');

-- Conversation groups
CREATE TABLE public.conversation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'A1',
  emoji text DEFAULT '💬',
  max_members integer DEFAULT 30,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Group memberships
CREATE TABLE public.group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.conversation_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Group messages (chat)
CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.conversation_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups viewable by authenticated" ON public.conversation_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers/admins can manage groups" ON public.conversation_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memberships viewable by authenticated" ON public.group_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.group_memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_memberships FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by group members" ON public.group_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can send messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM public.group_memberships WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

INSERT INTO public.conversation_groups (name, description, level, emoji, created_by) VALUES
  ('Everyday English', 'Pratique conversação sobre o dia a dia em inglês', 'A2', '🗣️', '00000000-0000-0000-0000-000000000000'),
  ('Business Talk', 'Discussões sobre inglês para negócios e carreira', 'B2', '💼', '00000000-0000-0000-0000-000000000000'),
  ('Movie Club', 'Discuta filmes e séries em inglês', 'B1', '🎬', '00000000-0000-0000-0000-000000000000'),
  ('Travel English', 'Vocabulário e situações de viagem', 'A2', '✈️', '00000000-0000-0000-0000-000000000000'),
  ('Debate Club', 'Debates sobre temas atuais para nível avançado', 'C1', '🎤', '00000000-0000-0000-0000-000000000000');

-- Remove group_messages from realtime publication (table already dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.group_messages;
  END IF;
END $$;

ALTER TABLE public.conversation_groups
  ADD COLUMN day_of_week text NOT NULL DEFAULT 'Quarta-feira',
  ADD COLUMN time_slot text NOT NULL DEFAULT '19:00',
  ADD COLUMN teacher_id uuid,
  ADD COLUMN meeting_url text,
  ADD COLUMN next_session_at timestamp with time zone;

UPDATE public.conversation_groups SET day_of_week = 'Segunda-feira', time_slot = '19:00' WHERE name = 'Everyday English';
UPDATE public.conversation_groups SET day_of_week = 'Terça-feira', time_slot = '20:00' WHERE name = 'Business Talk';
UPDATE public.conversation_groups SET day_of_week = 'Quarta-feira', time_slot = '19:30' WHERE name = 'Movie Club';
UPDATE public.conversation_groups SET day_of_week = 'Quinta-feira', time_slot = '18:30' WHERE name = 'Travel English';
UPDATE public.conversation_groups SET day_of_week = 'Sexta-feira', time_slot = '20:00' WHERE name = 'Debate Club';

-- Study preferences table
CREATE TABLE public.study_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_goal_minutes integer NOT NULL DEFAULT 30,
  daily_reviews integer NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.study_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own study preferences" ON public.study_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study preferences" ON public.study_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study preferences" ON public.study_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Notification settings table
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  study_reminders boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notification settings" ON public.notification_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON public.notification_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON public.notification_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars publicly readable" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- User achievements table to track unlocked badges
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  tier text NOT NULL DEFAULT 'bronze',
  xp_earned integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own achievements" ON public.user_achievements FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Activity history table for XP log
CREATE TABLE public.activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON public.activity_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.activity_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('tts-cache', 'tts-cache', true);

CREATE POLICY "TTS cache readable by all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tts-cache');
CREATE POLICY "Edge functions can insert TTS cache" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tts-cache');
CREATE POLICY "Public TTS cache read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'tts-cache');
