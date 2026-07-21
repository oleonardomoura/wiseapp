import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClassContentManager } from '@/components/content/ClassContentManager';
import { toast } from 'sonner';

type ClassOption = {
  id: string;
  name: string;
  level: string;
  teacher_name: string;
};

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AdminContentPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: classData, error: classErr } = await supabase
        .from('teacher_classes')
        .select('id, name, level, teacher_id')
        .order('name');
      if (classErr) {
        toast.error(classErr.message);
        setLoading(false);
        return;
      }

      const teacherIds = Array.from(new Set((classData ?? []).map(c => c.teacher_id)));
      const { data: profileData } = teacherIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
        : { data: [] as { id: string; full_name: string | null }[] };
      const nameById = new Map((profileData ?? []).map(p => [p.id, p.full_name || 'Professor']));

      const options = (classData ?? []).map(c => ({
        id: c.id,
        name: c.name,
        level: c.level,
        teacher_name: nameById.get(c.teacher_id) ?? 'Professor',
      }));
      setClasses(options);
      if (options.length > 0) setSelectedId(options[0].id);
      setLoading(false);
    };
    void load();
  }, []);

  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return classes.filter(c => {
      const matchesQuery = !query || c.name.toLowerCase().includes(query) || c.teacher_name.toLowerCase().includes(query);
      const matchesLevel = levelFilter === 'all' || c.level === levelFilter;
      return matchesQuery && matchesLevel;
    });
  }, [classes, searchQuery, levelFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || levelFilter !== 'all';
  const clearFilters = () => { setSearchQuery(''); setLevelFilter('all'); };

  useEffect(() => {
    if (filteredClasses.length === 0) return;
    if (!filteredClasses.some(c => c.id === selectedId)) {
      setSelectedId(filteredClasses[0].id);
    }
  }, [filteredClasses, selectedId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Conteúdo das Turmas</h1>
        <p className="text-muted-foreground">Gerencie materiais, curso, flashcards e textos de qualquer turma</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhuma turma cadastrada</h3>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum professor criou turmas ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por turma ou professor..."
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {LEVEL_OPTIONS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>

          {filteredClasses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <h3 className="font-semibold text-foreground">Nenhuma turma encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou o filtro de nível.</p>
            </div>
          ) : (
            <div className="max-w-sm space-y-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                <SelectContent>
                  {filteredClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.level} · {c.teacher_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedId && filteredClasses.some(c => c.id === selectedId) && (
            <ClassContentManager
              classId={selectedId}
              className={classes.find(c => c.id === selectedId)?.name}
              isAdmin
              allClasses={classes}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
