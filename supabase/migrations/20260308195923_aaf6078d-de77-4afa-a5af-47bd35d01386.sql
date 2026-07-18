
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

-- Table for user registrations/reminders for upcoming lives
CREATE TABLE public.live_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, user_id)
);

-- Table for recorded lives
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

-- RLS for live_sessions
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live sessions viewable by authenticated" ON public.live_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage live sessions" ON public.live_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- RLS for live_registrations
ALTER TABLE public.live_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own registrations" ON public.live_registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can register for lives" ON public.live_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unregister from lives" ON public.live_registrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS for recorded_lives
ALTER TABLE public.recorded_lives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recorded lives viewable by authenticated" ON public.recorded_lives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage recorded lives" ON public.recorded_lives FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

-- Enable realtime for live_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;

-- Seed some data
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
