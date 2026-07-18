import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function LessonPlanPage() {
  const { className } = useParams();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!className) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('teacher_classes')
        .select('name')
        .eq('id', className)
        .maybeSingle();
      setTitle(data?.name || className.replace(/-/g, ' '));
      setLoading(false);
    };
    void run();
  }, [className]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Plano de Aula — {loading ? 'Carregando...' : title}
          </h1>
          <p className="text-muted-foreground">Organize o conteúdo das aulas desta turma</p>
        </div>
        <Button className="gap-2 gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4" />
          Nova Aula
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : (
          <>
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold text-foreground">Nenhum plano de aula ainda</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comece adicionando aulas para esta turma
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
