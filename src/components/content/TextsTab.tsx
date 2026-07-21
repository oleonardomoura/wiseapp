import { useCallback, useEffect, useState } from 'react';
import { Headphones, Plus, Trash2, Loader2, ChevronLeft, Lightbulb, Sparkles, Wand2, CheckCircle2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { VisibilitySelector, type ClassOption } from '@/components/content/VisibilitySelector';
import { defaultVisibility, deleteContentTargets, fetchTargetLabels, saveContentTargets, type TargetLabelInfo } from '@/lib/content-targets';
import { matchVocabToSentences, parseAudioTextDocument, type ParsedAudioText } from '@/lib/audio-text-parser';

type TextRow = {
  id: string; title: string; title_pt: string; level: string; theme: string;
  seq: number; duration: string; full_text_pt: string | null; class_id: string | null;
};
type SentenceRow = { id: string; text_id: string; seq: number; en: string; pt: string };
type VocabRow = { id: string; sentence_id: string; word: string; translation: string; explanation: string | null };
type PhraseRow = { id: string; text_id: string; phrase: string; translation: string; explanation: string | null };
type TipRow = { id: string; text_id: string; seq: number; title: string; content: string };

interface TextsTabProps {
  classId: string;
  className?: string;
  isAdmin?: boolean;
  allClasses?: ClassOption[];
}

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function TextsTab({ classId, className, isAdmin = false, allClasses = [] }: TextsTabProps) {
  const [texts, setTexts] = useState<TextRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Map<string, TargetLabelInfo>>(new Map());
  const [selected, setSelected] = useState<TextRow | null>(null);
  const [sentences, setSentences] = useState<SentenceRow[]>([]);
  const [vocab, setVocab] = useState<VocabRow[]>([]);
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [titlePt, setTitlePt] = useState('');
  const [level, setLevel] = useState('A1');
  const [theme, setTheme] = useState('');
  const [duration, setDuration] = useState('1:30');
  const [fullTextPt, setFullTextPt] = useState('');
  const [savingText, setSavingText] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility());
  const [rawImportText, setRawImportText] = useState('');
  const [parsedImport, setParsedImport] = useState<ParsedAudioText | null>(null);

  const [sentenceDialogOpen, setSentenceDialogOpen] = useState(false);
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [en, setEn] = useState('');
  const [pt, setPt] = useState('');
  const [savingSentence, setSavingSentence] = useState(false);

  const [vocabDialogOpen, setVocabDialogOpen] = useState(false);
  const [vocabSentenceId, setVocabSentenceId] = useState<string | null>(null);
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [explanation, setExplanation] = useState('');
  const [savingVocab, setSavingVocab] = useState(false);

  const [phraseDialogOpen, setPhraseDialogOpen] = useState(false);
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [phraseText, setPhraseText] = useState('');
  const [phraseTranslation, setPhraseTranslation] = useState('');
  const [phraseExplanation, setPhraseExplanation] = useState('');
  const [savingPhrase, setSavingPhrase] = useState(false);

  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [editingTipId, setEditingTipId] = useState<string | null>(null);
  const [tipTitle, setTipTitle] = useState('');
  const [tipContent, setTipContent] = useState('');
  const [savingTip, setSavingTip] = useState(false);

  const loadTexts = useCallback(async () => {
    setLoading(true);
    const { data: idsData, error: idsError } = await supabase.rpc('visible_content_ids', {
      _content_type: 'audio_text',
      _class_id: classId,
    });
    if (idsError) { toast.error(idsError.message); setLoading(false); return; }
    const ids = (idsData ?? []).map(r => r.content_id);
    if (ids.length === 0) {
      setTexts([]);
      setTargetLabels(new Map());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('audio_texts')
      .select('id, title, title_pt, level, theme, seq, duration, full_text_pt, class_id')
      .in('id', ids)
      .order('seq');
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as TextRow[];
    setTexts(rows);
    setLoading(false);

    if (isAdmin) {
      const nullClassRows = rows.filter(r => r.class_id === null);
      if (nullClassRows.length > 0) setTargetLabels(await fetchTargetLabels('audio_text', nullClassRows.map(r => r.id)));
      else setTargetLabels(new Map());
    }
  }, [classId, isAdmin]);

  useEffect(() => { void loadTexts(); }, [loadTexts]);

  const loadDetail = useCallback(async (textId: string) => {
    setDetailLoading(true);
    const [sentRes, phrasesRes, tipsRes] = await Promise.all([
      supabase.from('audio_text_sentences').select('id, text_id, seq, en, pt').eq('text_id', textId).order('seq'),
      supabase.from('audio_text_phrases').select('id, text_id, phrase, translation, explanation').eq('text_id', textId),
      supabase.from('audio_text_tips').select('id, text_id, seq, title, content').eq('text_id', textId).order('seq'),
    ]);
    if (sentRes.error) { toast.error(sentRes.error.message); setDetailLoading(false); return; }
    const typedSentences = (sentRes.data ?? []) as SentenceRow[];
    setSentences(typedSentences);

    if (phrasesRes.error) toast.error(phrasesRes.error.message);
    else setPhrases((phrasesRes.data ?? []) as PhraseRow[]);

    if (tipsRes.error) toast.error(tipsRes.error.message);
    else setTips((tipsRes.data ?? []) as TipRow[]);

    if (typedSentences.length > 0) {
      const { data: vocabData, error: vocabErr } = await supabase
        .from('audio_text_vocabulary')
        .select('id, sentence_id, word, translation, explanation')
        .in('sentence_id', typedSentences.map(s => s.id));
      if (vocabErr) toast.error(vocabErr.message);
      else setVocab((vocabData ?? []) as VocabRow[]);
    } else {
      setVocab([]);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selected) void loadDetail(selected.id);
  }, [selected, loadDetail]);

  const resetTextForm = () => {
    setTitle(''); setTitlePt(''); setLevel('A1'); setTheme(''); setDuration('1:30'); setFullTextPt('');
    setVisibility(defaultVisibility());
    setRawImportText(''); setParsedImport(null);
  };

  const processImport = () => {
    if (!rawImportText.trim()) {
      toast.error('Cole o texto estruturado primeiro');
      return;
    }
    const parsed = parseAudioTextDocument(rawImportText);
    if (parsed.sentences.length === 0) {
      toast.error('Não encontrei a seção "3. ESTUDO ATIVO" com as frases. Confira o formato do texto colado.');
      return;
    }
    if (parsed.title) setTitle(parsed.title);
    if (parsed.title_pt) setTitlePt(parsed.title_pt);
    if (parsed.level && LEVEL_OPTIONS.includes(parsed.level)) setLevel(parsed.level);
    if (parsed.theme) setTheme(parsed.theme);
    if (parsed.duration) setDuration(parsed.duration);
    if (parsed.full_text_pt) setFullTextPt(parsed.full_text_pt);
    setParsedImport(parsed);
    toast.success(
      `Detectado: ${parsed.sentences.length} frases, ${parsed.phrases.length} expressões, ${parsed.tips.length} dicas, ${parsed.vocabItems.length} itens de vocabulário`
    );
  };

  const createText = async () => {
    if (!title.trim() || !titlePt.trim()) {
      toast.error('Informe o título em inglês e português');
      return;
    }
    setSavingText(true);
    try {
      const nextSeq = texts.length > 0 ? Math.max(...texts.map(t => t.seq)) + 1 : 1;
      const targeted = isAdmin && visibility.mode !== 'class';
      const { data: inserted, error } = await supabase
        .from('audio_texts')
        .insert({
          title: title.trim(),
          title_pt: titlePt.trim(),
          level,
          theme: theme.trim() || 'Daily Life',
          seq: nextSeq,
          duration: duration.trim() || '1:30',
          full_text_pt: fullTextPt.trim() || null,
          class_id: targeted ? null : classId,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (targeted && inserted) {
        await saveContentTargets('audio_text', inserted.id, visibility);
      }

      if (parsedImport && inserted) {
        const textId = inserted.id;

        const { data: insertedSentences, error: sentErr } = await supabase
          .from('audio_text_sentences')
          .insert(parsedImport.sentences.map((s, idx) => ({ text_id: textId, seq: idx + 1, en: s.en, pt: s.pt || s.en })))
          .select('id, en');
        if (sentErr) throw sentErr;

        if (parsedImport.vocabItems.length > 0 && insertedSentences) {
          const vocabPayload = matchVocabToSentences(parsedImport.vocabItems, insertedSentences);
          const { error: vocabErr } = await supabase.from('audio_text_vocabulary').insert(vocabPayload);
          if (vocabErr) throw vocabErr;
        }

        if (parsedImport.phrases.length > 0) {
          const { error: phraseErr } = await supabase.from('audio_text_phrases').insert(
            parsedImport.phrases.map(p => ({ text_id: textId, phrase: p.phrase, translation: p.translation, explanation: p.explanation }))
          );
          if (phraseErr) throw phraseErr;
        }

        if (parsedImport.tips.length > 0) {
          const { error: tipErr } = await supabase.from('audio_text_tips').insert(
            parsedImport.tips.map((t, idx) => ({ text_id: textId, seq: idx + 1, title: t.title, content: t.content }))
          );
          if (tipErr) throw tipErr;
        }
      }

      toast.success(parsedImport ? 'Texto criado com todo o conteúdo importado' : 'Texto criado');
      setTextDialogOpen(false);
      resetTextForm();
      await loadTexts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar texto');
    } finally {
      setSavingText(false);
    }
  };

  const removeText = async (t: TextRow) => {
    const ok = window.confirm(`Excluir o texto "${t.title}"?`);
    if (!ok) return;
    const { error } = await supabase.from('audio_texts').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await deleteContentTargets('audio_text', t.id);
    toast.success('Texto removido');
    if (selected?.id === t.id) setSelected(null);
    await loadTexts();
  };

  const openNewSentence = () => { setEditingSentenceId(null); setEn(''); setPt(''); setSentenceDialogOpen(true); };

  const openEditSentence = (s: SentenceRow) => {
    setEditingSentenceId(s.id); setEn(s.en); setPt(s.pt); setSentenceDialogOpen(true);
  };

  const saveSentence = async () => {
    if (!selected) return;
    if (!en.trim() || !pt.trim()) {
      toast.error('Preencha o texto em inglês e português');
      return;
    }
    setSavingSentence(true);
    try {
      if (editingSentenceId) {
        const { error } = await supabase.from('audio_text_sentences').update({ en: en.trim(), pt: pt.trim() }).eq('id', editingSentenceId);
        if (error) throw error;
        toast.success('Frase atualizada');
      } else {
        const nextSeq = sentences.length > 0 ? Math.max(...sentences.map(s => s.seq)) + 1 : 1;
        const { error } = await supabase.from('audio_text_sentences').insert({
          text_id: selected.id, seq: nextSeq, en: en.trim(), pt: pt.trim(),
        });
        if (error) throw error;
        toast.success('Frase adicionada');
      }
      setSentenceDialogOpen(false);
      await loadDetail(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar frase');
    } finally {
      setSavingSentence(false);
    }
  };

  const removeSentence = async (s: SentenceRow) => {
    const ok = window.confirm('Excluir esta frase e seu vocabulário associado?');
    if (!ok || !selected) return;
    const { error } = await supabase.from('audio_text_sentences').delete().eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Frase removida');
    await loadDetail(selected.id);
  };

  const openNewVocab = (sentenceId: string) => {
    setVocabSentenceId(sentenceId);
    setWord(''); setTranslation(''); setExplanation('');
    setVocabDialogOpen(true);
  };

  const saveVocab = async () => {
    if (!vocabSentenceId || !selected) return;
    if (!word.trim() || !translation.trim()) {
      toast.error('Preencha a palavra e a tradução');
      return;
    }
    setSavingVocab(true);
    try {
      const { error } = await supabase.from('audio_text_vocabulary').insert({
        sentence_id: vocabSentenceId, word: word.trim(), translation: translation.trim(), explanation: explanation.trim() || null,
      });
      if (error) throw error;
      toast.success('Palavra adicionada');
      setVocabDialogOpen(false);
      await loadDetail(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar palavra');
    } finally {
      setSavingVocab(false);
    }
  };

  const removeVocab = async (v: VocabRow) => {
    if (!selected) return;
    const { error } = await supabase.from('audio_text_vocabulary').delete().eq('id', v.id);
    if (error) { toast.error(error.message); return; }
    await loadDetail(selected.id);
  };

  const openNewPhrase = () => {
    setEditingPhraseId(null);
    setPhraseText(''); setPhraseTranslation(''); setPhraseExplanation('');
    setPhraseDialogOpen(true);
  };

  const openEditPhrase = (p: PhraseRow) => {
    setEditingPhraseId(p.id);
    setPhraseText(p.phrase); setPhraseTranslation(p.translation); setPhraseExplanation(p.explanation ?? '');
    setPhraseDialogOpen(true);
  };

  const savePhrase = async () => {
    if (!selected) return;
    if (!phraseText.trim() || !phraseTranslation.trim()) {
      toast.error('Preencha a expressão e a tradução');
      return;
    }
    setSavingPhrase(true);
    try {
      if (editingPhraseId) {
        const { error } = await supabase.from('audio_text_phrases').update({
          phrase: phraseText.trim(), translation: phraseTranslation.trim(), explanation: phraseExplanation.trim() || null,
        }).eq('id', editingPhraseId);
        if (error) throw error;
        toast.success('Expressão atualizada');
      } else {
        const { error } = await supabase.from('audio_text_phrases').insert({
          text_id: selected.id, phrase: phraseText.trim(), translation: phraseTranslation.trim(), explanation: phraseExplanation.trim() || null,
        });
        if (error) throw error;
        toast.success('Expressão adicionada');
      }
      setPhraseDialogOpen(false);
      await loadDetail(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar expressão');
    } finally {
      setSavingPhrase(false);
    }
  };

  const removePhrase = async (p: PhraseRow) => {
    if (!selected) return;
    const { error } = await supabase.from('audio_text_phrases').delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    await loadDetail(selected.id);
  };

  const openNewTip = () => {
    setEditingTipId(null);
    setTipTitle(''); setTipContent('');
    setTipDialogOpen(true);
  };

  const openEditTip = (t: TipRow) => {
    setEditingTipId(t.id);
    setTipTitle(t.title); setTipContent(t.content);
    setTipDialogOpen(true);
  };

  const saveTip = async () => {
    if (!selected) return;
    if (!tipTitle.trim() || !tipContent.trim()) {
      toast.error('Preencha o título e o conteúdo da dica');
      return;
    }
    setSavingTip(true);
    try {
      if (editingTipId) {
        const { error } = await supabase.from('audio_text_tips').update({
          title: tipTitle.trim(), content: tipContent.trim(),
        }).eq('id', editingTipId);
        if (error) throw error;
        toast.success('Dica atualizada');
      } else {
        const nextSeq = tips.length > 0 ? Math.max(...tips.map(t => t.seq)) + 1 : 1;
        const { error } = await supabase.from('audio_text_tips').insert({
          text_id: selected.id, seq: nextSeq, title: tipTitle.trim(), content: tipContent.trim(),
        });
        if (error) throw error;
        toast.success('Dica adicionada');
      }
      setTipDialogOpen(false);
      await loadDetail(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dica');
    } finally {
      setSavingTip(false);
    }
  };

  const removeTip = async (t: TipRow) => {
    if (!selected) return;
    const { error } = await supabase.from('audio_text_tips').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    await loadDetail(selected.id);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelected(null)}>
          <ChevronLeft className="h-4 w-4" /> {selected.title}
        </Button>

        <Tabs defaultValue="sentences" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sentences">Frases</TabsTrigger>
            <TabsTrigger value="phrases" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Expressões</TabsTrigger>
            <TabsTrigger value="tips" className="gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Dicas</TabsTrigger>
          </TabsList>

          <TabsContent value="sentences" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Frases do texto, em ordem, com o vocabulário de cada uma</p>
              <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={openNewSentence}>
                <Plus className="h-4 w-4" /> Nova frase
              </Button>
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sentences.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma frase ainda. Adicione as frases do texto em ordem.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentences.map(s => {
                  const sentenceVocab = vocab.filter(v => v.sentence_id === s.id);
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{s.seq}. {s.en}</p>
                          <p className="text-sm text-muted-foreground">{s.pt}</p>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => openEditSentence(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" onClick={() => removeSentence(s)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {sentenceVocab.map(v => (
                          <button
                            key={v.id}
                            onClick={() => removeVocab(v)}
                            title="Clique para remover"
                            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-destructive/10 hover:text-destructive"
                          >
                            {v.word} → {v.translation} ×
                          </button>
                        ))}
                        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => openNewVocab(s.id)}>
                          <Plus className="h-3 w-3" /> Vocabulário
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="phrases" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Expressões-chave do texto, destacadas em âmbar na aba "Entender" do aluno</p>
              <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={openNewPhrase}>
                <Plus className="h-4 w-4" /> Nova expressão
              </Button>
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : phrases.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma expressão ainda. São opcionais — só aparecem se cadastradas aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {phrases.map(p => (
                  <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.phrase}</p>
                      <p className="text-sm text-muted-foreground">{p.translation}</p>
                      {p.explanation && <p className="text-xs text-muted-foreground mt-1">{p.explanation}</p>}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => openEditPhrase(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => removePhrase(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tips" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Dicas gramaticais/culturais do texto, exibidas no painel "Dicas" do aluno</p>
              <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={openNewTip}>
                <Plus className="h-4 w-4" /> Nova dica
              </Button>
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : tips.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma dica ainda. Sem dicas, o botão "Dicas" não aparece para o aluno.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tips.map(t => (
                  <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{t.seq}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground uppercase">{t.title}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{t.content}</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => openEditTip(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => removeTip(t)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={sentenceDialogOpen} onOpenChange={setSentenceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingSentenceId ? 'Editar frase' : 'Nova frase'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Inglês</Label><Textarea value={en} onChange={e => setEn(e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Português</Label><Textarea value={pt} onChange={e => setPt(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSentenceDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveSentence} disabled={savingSentence} className="gradient-primary text-primary-foreground">
                {savingSentence ? <Loader2 className="h-4 w-4 animate-spin" /> : editingSentenceId ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={vocabDialogOpen} onOpenChange={setVocabDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova palavra de vocabulário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Palavra (inglês)</Label><Input value={word} onChange={e => setWord(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tradução</Label><Input value={translation} onChange={e => setTranslation(e.target.value)} /></div>
              <div className="space-y-2"><Label>Explicação (opcional)</Label><Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVocabDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveVocab} disabled={savingVocab} className="gradient-primary text-primary-foreground">
                {savingVocab ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={phraseDialogOpen} onOpenChange={setPhraseDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPhraseId ? 'Editar expressão' : 'Nova expressão'}</DialogTitle>
              <DialogDescription>Expressões ou frases inteiras (não uma palavra só), destacadas em âmbar para o aluno.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Expressão (inglês)</Label><Input value={phraseText} onChange={e => setPhraseText(e.target.value)} placeholder="Ex: right on time" /></div>
              <div className="space-y-2"><Label>Tradução</Label><Input value={phraseTranslation} onChange={e => setPhraseTranslation(e.target.value)} placeholder="Ex: bem na hora" /></div>
              <div className="space-y-2"><Label>Explicação (opcional)</Label><Textarea value={phraseExplanation} onChange={e => setPhraseExplanation(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhraseDialogOpen(false)}>Cancelar</Button>
              <Button onClick={savePhrase} disabled={savingPhrase} className="gradient-primary text-primary-foreground">
                {savingPhrase ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPhraseId ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTipId ? 'Editar dica' : 'Nova dica'}</DialogTitle>
              <DialogDescription>Dicas gramaticais ou culturais, exibidas em ordem no painel "Dicas" do aluno.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Título</Label><Input value={tipTitle} onChange={e => setTipTitle(e.target.value)} placeholder="Ex: Present Simple" /></div>
              <div className="space-y-2"><Label>Conteúdo</Label><Textarea value={tipContent} onChange={e => setTipContent(e.target.value)} rows={4} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTipDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveTip} disabled={savingTip} className="gradient-primary text-primary-foreground">
                {savingTip ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTipId ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Textos com áudio desta turma</p>
        <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={() => { resetTextForm(); setTextDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo texto
        </Button>
      </div>

      {texts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhum texto ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie um texto e adicione as frases para esta turma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {texts.map(t => (
            <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <button className="flex-1 min-w-0 text-left" onClick={() => setSelected(t)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{t.title}</p>
                  {isAdmin && t.class_id === null && (
                    <Badge variant="outline" className="shrink-0 text-xs">{targetLabels.get(t.id)?.label ?? 'Todas as turmas'}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Nível {t.level} · {t.theme}</p>
              </button>
              <Button variant="outline" size="icon" onClick={() => removeText(t)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={textDialogOpen} onOpenChange={(open) => { setTextDialogOpen(open); if (!open) resetTextForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo texto</DialogTitle>
            <DialogDescription>Cole o texto estruturado (mesmo formato dos textos já usados) para preencher tudo automaticamente, ou preencha os campos manualmente abaixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Label>Colar texto estruturado</Label>
              <Textarea
                value={rawImportText}
                onChange={e => setRawImportText(e.target.value)}
                placeholder={'Nível A1 - Unidade 01: First Meeting\nTítulo da Cena: The Coffee Shop (A Cafeteria)\n...\n1. TEXTO FLUÍDO - EN\n...\n3. ESTUDO ATIVO (LINHA POR LINHA)\n...'}
                rows={8}
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={processImport}>
                <Wand2 className="h-4 w-4" /> Processar texto
              </Button>
              {parsedImport && (
                <p className="flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {parsedImport.sentences.length} frases · {parsedImport.phrases.length} expressões · {parsedImport.tips.length} dicas · {parsedImport.vocabItems.length} vocabulário — revise os campos abaixo e clique em Criar
                </p>
              )}
            </div>

            <div className="space-y-2"><Label>Título (inglês)</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Título (português)</Label><Input value={titlePt} onChange={e => setTitlePt(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVEL_OPTIONS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Tema</Label><Input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Ex: Daily Life" /></div>
            <div className="space-y-2"><Label>Duração estimada</Label><Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ex: 1:30" /></div>
            <div className="space-y-2"><Label>Texto completo em português (opcional)</Label><Textarea value={fullTextPt} onChange={e => setFullTextPt(e.target.value)} rows={4} /></div>
            {isAdmin && (
              <VisibilitySelector value={visibility} onChange={setVisibility} classes={allClasses} currentClassName={className ?? ''} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createText} disabled={savingText} className="gradient-primary text-primary-foreground">
              {savingText ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
