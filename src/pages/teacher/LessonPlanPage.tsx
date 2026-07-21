import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ClassContentManager } from '@/components/content/ClassContentManager';

export default function LessonPlanPage() {
  const { className: classId } = useParams();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!classId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('teacher_classes')
        .select('name')
        .eq('id', classId)
        .maybeSingle();
      setTitle(data?.name || classId.replace(/-/g, ' '));
      setLoading(false);
    };
    void run();
  }, [classId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Conteúdo da Turma — {loading ? 'Carregando...' : title}
        </h1>
        <p className="text-muted-foreground">Materiais, curso, flashcards e textos com áudio desta turma</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : classId ? (
        <ClassContentManager classId={classId} />
      ) : null}
    </motion.div>
  );
}
