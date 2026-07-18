
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

-- Enable RLS
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

-- Users can view own progress
CREATE POLICY "Users can view own course progress"
ON public.course_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own progress
CREATE POLICY "Users can insert own course progress"
ON public.course_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update own progress
CREATE POLICY "Users can update own course progress"
ON public.course_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_course_progress_updated_at
  BEFORE UPDATE ON public.course_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
