import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Mic, PenLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VisibilitySelector, type ClassOption } from '@/components/content/VisibilitySelector';
import { defaultVisibility, deleteContentTargets, fetchTargetLabels, saveContentTargets, type TargetLabelInfo } from '@/lib/content-targets';

type ModuleRow = { id: number; title: string; level: string; order: number; class_id: string | null };
type LessonRow = { id: number; module_id: number; title: string; order: number };
type OralItem = { id: string; lesson_id: number; phrase: string; translation: string; order: number };
type ConsolidationItem = { id: string; lesson_id: number; prompt: string; answer: string; acceptable: string[]; order: number };

interface CourseContentTabProps {
  classId: string;
  className?: string;
  isAdmin?: boolean;
  allClasses?: ClassOption[];
}

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function CourseContentTab({ classId, className, isAdmin = false, allClasses = [] }: CourseContentTabProps) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Map<string, TargetLabelInfo>>(new Map());
  const [visibility, setVisibility] = useState(defaultVisibility());
  const [selectedModule, setSelectedModule] = useState<ModuleRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonRow | null>(null);
  const [oralItems, setOralItems] = useState<OralItem[]>([]);
  const [consolidationItems, setConsolidationItems] = useState<ConsolidationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleLevel, setModuleLevel] = useState('A1');
  const [savingModule, setSavingModule] = useState(false);

  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);

  const [oralDialogOpen, setOralDialogOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [savingOral, setSavingOral] = useState(false);

  const [consolidationDialogOpen, setConsolidationDialogOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [acceptable, setAcceptable] = useState('');
  const [savingConsolidation, setSavingConsolidation] = useState(false);

  const loadModules = useCallback(async () => {
    setLoading(true);
    const { data: idsData, error: idsError } = await supabase.rpc('visible_content_ids', {
      _content_type: 'course',
      _class_id: classId,
    });
    if (idsError) { toast.error(idsError.message); setLoading(false); return; }
    const ids = (idsData ?? []).map(r => Number(r.content_id));
    if (ids.length === 0) {
      setModules([]);
      setTargetLabels(new Map());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('course_modules')
      .select('id, title, level, order, class_id')
      .in('id', ids)
      .order('order');
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as ModuleRow[];
    setModules(rows);
    setLoading(false);

    if (isAdmin) {
      const nullClassRows = rows.filter(r => r.class_id === null);
      if (nullClassRows.length > 0) setTargetLabels(await fetchTargetLabels('course', nullClassRows.map(r => String(r.id))));
      else setTargetLabels(new Map());
    }
  }, [classId, isAdmin]);

  useEffect(() => { void loadModules(); }, [loadModules]);

  const loadLessons = useCallback(async (moduleId: number) => {
    setLessonsLoading(true);
    const { data, error } = await supabase
      .from('course_lessons')
      .select('id, module_id, title, order')
      .eq('module_id', moduleId)
      .order('order');
    if (error) toast.error(error.message);
    else setLessons((data ?? []) as LessonRow[]);
    setLessonsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedModule) void loadLessons(selectedModule.id);
  }, [selectedModule, loadLessons]);

  const loadItems = useCallback(async (lessonId: number) => {
    setItemsLoading(true);
    const [oralRes, consRes] = await Promise.all([
      supabase.from('oral_practice_items').select('id, lesson_id, phrase, translation, order').eq('lesson_id', lessonId).order('order'),
      supabase.from('consolidation_items').select('id, lesson_id, prompt, answer, acceptable, order').eq('lesson_id', lessonId).order('order'),
    ]);
    if (oralRes.error) toast.error(oralRes.error.message);
    else setOralItems((oralRes.data ?? []) as OralItem[]);
    if (consRes.error) toast.error(consRes.error.message);
    else setConsolidationItems((consRes.data ?? []) as ConsolidationItem[]);
    setItemsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedLesson) void loadItems(selectedLesson.id);
  }, [selectedLesson, loadItems]);

  const createModule = async () => {
    if (!moduleTitle.trim()) { toast.error('Informe o título do módulo'); return; }
    setSavingModule(true);
    try {
      const nextOrder = modules.length > 0 ? Math.max(...modules.map(m => m.order)) + 1 : 1;
      const targeted = isAdmin && visibility.mode !== 'class';
      const { data: inserted, error } = await supabase
        .from('course_modules')
        .insert({
          title: moduleTitle.trim(), level: moduleLevel, class_id: targeted ? null : classId, order: nextOrder,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (targeted && inserted) {
        await saveContentTargets('course', String(inserted.id), visibility);
      }

      toast.success('Módulo criado');
      setModuleDialogOpen(false);
      setModuleTitle(''); setModuleLevel('A1'); setVisibility(defaultVisibility());
      await loadModules();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar módulo');
    } finally {
      setSavingModule(false);
    }
  };

  const removeModule = async (m: ModuleRow) => {
    const ok = window.confirm(`Excluir o módulo "${m.title}" e todas as suas lições?`);
    if (!ok) return;
    const { error } = await supabase.from('course_modules').delete().eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    await deleteContentTargets('course', String(m.id));
    toast.success('Módulo removido');
    if (selectedModule?.id === m.id) setSelectedModule(null);
    await loadModules();
  };

  const createLesson = async () => {
    if (!selectedModule || !lessonTitle.trim()) { toast.error('Informe o título da lição'); return; }
    setSavingLesson(true);
    try {
      const nextOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.order)) + 1 : 1;
      const { error } = await supabase.from('course_lessons').insert({
        title: lessonTitle.trim(), module_id: selectedModule.id, class_id: classId, order: nextOrder,
      });
      if (error) throw error;
      toast.success('Lição criada');
      setLessonDialogOpen(false);
      setLessonTitle('');
      await loadLessons(selectedModule.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lição');
    } finally {
      setSavingLesson(false);
    }
  };

  const removeLesson = async (l: LessonRow) => {
    const ok = window.confirm(`Excluir a lição "${l.title}"?`);
    if (!ok || !selectedModule) return;
    const { error } = await supabase.from('course_lessons').delete().eq('id', l.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Lição removida');
    if (selectedLesson?.id === l.id) setSelectedLesson(null);
    await loadLessons(selectedModule.id);
  };

  const createOralItem = async () => {
    if (!selectedLesson || !phrase.trim() || !translation.trim()) { toast.error('Preencha a frase e a tradução'); return; }
    setSavingOral(true);
    try {
      const nextOrder = oralItems.length > 0 ? Math.max(...oralItems.map(i => i.order)) + 1 : 1;
      const { error } = await supabase.from('oral_practice_items').insert({
        lesson_id: selectedLesson.id, class_id: classId, phrase: phrase.trim(), translation: translation.trim(), order: nextOrder,
      });
      if (error) throw error;
      toast.success('Frase de prática oral adicionada');
      setOralDialogOpen(false);
      setPhrase(''); setTranslation('');
      await loadItems(selectedLesson.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar frase');
    } finally {
      setSavingOral(false);
    }
  };

  const removeOralItem = async (item: OralItem) => {
    if (!selectedLesson) return;
    const { error } = await supabase.from('oral_practice_items').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await loadItems(selectedLesson.id);
  };

  const createConsolidationItem = async () => {
    if (!selectedLesson || !prompt.trim() || !answer.trim()) { toast.error('Preencha o enunciado e a resposta'); return; }
    setSavingConsolidation(true);
    try {
      const nextOrder = consolidationItems.length > 0 ? Math.max(...consolidationItems.map(i => i.order)) + 1 : 1;
      const acceptableList = acceptable.split('\n').map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from('consolidation_items').insert({
        lesson_id: selectedLesson.id, class_id: classId, prompt: prompt.trim(), answer: answer.trim(), acceptable: acceptableList, order: nextOrder,
      });
      if (error) throw error;
      toast.success('Exercício de consolidação adicionado');
      setConsolidationDialogOpen(false);
      setPrompt(''); setAnswer(''); setAcceptable('');
      await loadItems(selectedLesson.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar exercício');
    } finally {
      setSavingConsolidation(false);
    }
  };

  const removeConsolidationItem = async (item: ConsolidationItem) => {
    if (!selectedLesson) return;
    const { error } = await supabase.from('consolidation_items').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await loadItems(selectedLesson.id);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Lesson detail: oral practice + consolidation ──
  if (selectedModule && selectedLesson) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedLesson(null)}>
          <ChevronLeft className="h-4 w-4" /> {selectedLesson.title}
        </Button>

        {itemsLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-semibold text-foreground"><Mic className="h-4 w-4 text-primary" /> Prática Oral</h4>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setOralDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              {oralItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma frase ainda.</p>
              ) : (
                <div className="space-y-2">
                  {oralItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.phrase}</p>
                        <p className="text-xs text-muted-foreground">{item.translation}</p>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeOralItem(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 font-semibold text-foreground"><PenLine className="h-4 w-4 text-primary" /> Consolidação</h4>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setConsolidationDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              {consolidationItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum exercício ainda.</p>
              ) : (
                <div className="space-y-2">
                  {consolidationItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.prompt}</p>
                        <p className="text-xs text-muted-foreground">{item.answer}{item.acceptable.length > 0 ? ` (+${item.acceptable.length} variações)` : ''}</p>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeConsolidationItem(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Dialog open={oralDialogOpen} onOpenChange={setOralDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova frase de prática oral</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Frase (inglês)</Label><Input value={phrase} onChange={e => setPhrase(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tradução</Label><Input value={translation} onChange={e => setTranslation(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOralDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createOralItem} disabled={savingOral} className="gradient-primary text-primary-foreground">
                {savingOral ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={consolidationDialogOpen} onOpenChange={setConsolidationDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo exercício de consolidação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Enunciado (português)</Label><Input value={prompt} onChange={e => setPrompt(e.target.value)} /></div>
              <div className="space-y-2"><Label>Resposta correta (inglês)</Label><Input value={answer} onChange={e => setAnswer(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Respostas alternativas aceitas (uma por linha, opcional)</Label>
                <Input value={acceptable} onChange={e => setAcceptable(e.target.value)} placeholder="Deixe em branco se não houver" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConsolidationDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createConsolidationItem} disabled={savingConsolidation} className="gradient-primary text-primary-foreground">
                {savingConsolidation ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Module detail: lessons list ──
  if (selectedModule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedModule(null)}>
            <ChevronLeft className="h-4 w-4" /> {selectedModule.title}
          </Button>
          <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={() => setLessonDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Nova lição
          </Button>
        </div>

        {lessonsLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : lessons.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma lição ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map(l => (
              <div key={l.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <button className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={() => setSelectedLesson(l)}>
                  <span className="font-medium text-foreground">{l.title}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <Button variant="outline" size="icon" onClick={() => removeLesson(l)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova lição</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Título</Label><Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createLesson} disabled={savingLesson} className="gradient-primary text-primary-foreground">
                {savingLesson ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Modules list ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Módulos do curso desta turma</p>
        <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={() => setModuleDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Novo módulo
        </Button>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhum módulo ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie módulos e lições com conteúdo específico para esta turma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map(m => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <button className="flex-1 min-w-0 text-left" onClick={() => setSelectedModule(m)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{m.title}</p>
                  {isAdmin && m.class_id === null && (
                    <Badge variant="outline" className="shrink-0 text-xs">{targetLabels.get(String(m.id))?.label ?? 'Todas as turmas'}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Nível {m.level}</p>
              </button>
              <Button variant="outline" size="icon" onClick={() => removeModule(m)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo módulo</DialogTitle>
            <DialogDescription>Conteúdo específico para esta turma (não afeta o curso global).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={moduleLevel} onValueChange={setModuleLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVEL_OPTIONS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <VisibilitySelector value={visibility} onChange={setVisibility} classes={allClasses} currentClassName={className ?? ''} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createModule} disabled={savingModule} className="gradient-primary text-primary-foreground">
              {savingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
