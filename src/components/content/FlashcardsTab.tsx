import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Loader2, Pencil, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { VisibilitySelector, type ClassOption } from '@/components/content/VisibilitySelector';
import { defaultVisibility, deleteContentTargets, fetchTargetLabels, saveContentTargets, type TargetLabelInfo } from '@/lib/content-targets';

type CollectionRow = { id: string; name: string; level: string; class_id: string | null };
type FlashcardRow = { id: string; collection_id: string; front: string; back: string };

interface FlashcardsTabProps {
  classId: string;
  className?: string;
  isAdmin?: boolean;
  allClasses?: ClassOption[];
}

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function FlashcardsTab({ classId, className, isAdmin = false, allClasses = [] }: FlashcardsTabProps) {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Map<string, TargetLabelInfo>>(new Map());
  const [selected, setSelected] = useState<CollectionRow | null>(null);
  const [cards, setCards] = useState<FlashcardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(false);

  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionLevel, setCollectionLevel] = useState('A1');
  const [savingCollection, setSavingCollection] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility());

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardRow | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    const { data: idsData, error: idsError } = await supabase.rpc('visible_content_ids', {
      _content_type: 'flashcards',
      _class_id: classId,
    });
    if (idsError) { toast.error(idsError.message); setLoading(false); return; }
    const ids = (idsData ?? []).map(r => r.content_id);
    if (ids.length === 0) {
      setCollections([]);
      setTargetLabels(new Map());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('flashcard_collections')
      .select('id, name, level, class_id')
      .in('id', ids)
      .order('name');
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as CollectionRow[];
    setCollections(rows);
    setLoading(false);

    if (isAdmin) {
      const nullClassRows = rows.filter(r => r.class_id === null);
      if (nullClassRows.length > 0) setTargetLabels(await fetchTargetLabels('flashcards', nullClassRows.map(r => r.id)));
      else setTargetLabels(new Map());
    }
  }, [classId, isAdmin]);

  useEffect(() => { void loadCollections(); }, [loadCollections]);

  const loadCards = useCallback(async (collectionId: string) => {
    setCardsLoading(true);
    const { data, error } = await supabase
      .from('flashcards')
      .select('id, collection_id, front, back')
      .eq('collection_id', collectionId)
      .order('created_at');
    if (error) toast.error(error.message);
    else setCards((data ?? []) as FlashcardRow[]);
    setCardsLoading(false);
  }, []);

  useEffect(() => {
    if (selected) void loadCards(selected.id);
  }, [selected, loadCards]);

  const resetCollectionForm = () => {
    setCollectionName('');
    setCollectionLevel('A1');
    setVisibility(defaultVisibility());
  };

  const createCollection = async () => {
    if (!collectionName.trim()) {
      toast.error('Informe o nome da coleção');
      return;
    }
    setSavingCollection(true);
    try {
      const targeted = isAdmin && visibility.mode !== 'class';
      const { data: inserted, error } = await supabase
        .from('flashcard_collections')
        .insert({
          name: collectionName.trim(),
          level: collectionLevel,
          class_id: targeted ? null : classId,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (targeted && inserted) {
        await saveContentTargets('flashcards', inserted.id, visibility);
      }

      toast.success('Coleção criada');
      setCollectionDialogOpen(false);
      resetCollectionForm();
      await loadCollections();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar coleção');
    } finally {
      setSavingCollection(false);
    }
  };

  const removeCollection = async (c: CollectionRow) => {
    const ok = window.confirm(`Excluir a coleção "${c.name}" e todos os seus flashcards?`);
    if (!ok) return;
    const { error } = await supabase.from('flashcard_collections').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    await deleteContentTargets('flashcards', c.id);
    toast.success('Coleção removida');
    if (selected?.id === c.id) setSelected(null);
    await loadCollections();
  };

  const openNewCard = () => {
    setEditingCard(null);
    setFront('');
    setBack('');
    setCardDialogOpen(true);
  };

  const openEditCard = (card: FlashcardRow) => {
    setEditingCard(card);
    setFront(card.front);
    setBack(card.back);
    setCardDialogOpen(true);
  };

  const saveCard = async () => {
    if (!selected) return;
    if (!front.trim() || !back.trim()) {
      toast.error('Preencha frente e verso');
      return;
    }
    setSavingCard(true);
    try {
      if (editingCard) {
        const { error } = await supabase.from('flashcards').update({ front: front.trim(), back: back.trim() }).eq('id', editingCard.id);
        if (error) throw error;
        toast.success('Flashcard atualizado');
      } else {
        const { error } = await supabase.from('flashcards').insert({ collection_id: selected.id, front: front.trim(), back: back.trim() });
        if (error) throw error;
        toast.success('Flashcard adicionado');
      }
      setCardDialogOpen(false);
      await loadCards(selected.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar flashcard');
    } finally {
      setSavingCard(false);
    }
  };

  const removeCard = async (card: FlashcardRow) => {
    const ok = window.confirm('Excluir este flashcard?');
    if (!ok || !selected) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', card.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Flashcard removido');
    await loadCards(selected.id);
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
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-4 w-4" /> {selected.name}
          </Button>
          <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={openNewCard}>
            <Plus className="h-4 w-4" /> Novo flashcard
          </Button>
        </div>

        {cardsLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum flashcard nesta coleção ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map(card => (
              <div key={card.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                  <p className="text-sm font-medium text-foreground truncate">{card.front}</p>
                  <p className="text-sm text-muted-foreground truncate">{card.back}</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => openEditCard(card)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => removeCard(card)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCard ? 'Editar flashcard' : 'Novo flashcard'}</DialogTitle>
              <DialogDescription>Frente em inglês, verso em português (ou vice-versa).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Frente</Label>
                <Input value={front} onChange={e => setFront(e.target.value)} placeholder="Ex: Hello" />
              </div>
              <div className="space-y-2">
                <Label>Verso</Label>
                <Input value={back} onChange={e => setBack(e.target.value)} placeholder="Ex: Olá" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveCard} disabled={savingCard} className="gradient-primary text-primary-foreground">
                {savingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
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
        <p className="text-sm text-muted-foreground">Coleções de flashcards desta turma</p>
        <Button size="sm" className="gap-2 gradient-primary text-primary-foreground" onClick={() => { resetCollectionForm(); setCollectionDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova coleção
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhuma coleção ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie uma coleção para adicionar flashcards para esta turma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map(c => (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <button className="flex-1 min-w-0 text-left" onClick={() => setSelected(c)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  {isAdmin && c.class_id === null && (
                    <Badge variant="outline" className="shrink-0 text-xs">{targetLabels.get(c.id)?.label ?? 'Todas as turmas'}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Nível {c.level}</p>
              </button>
              <Button variant="outline" size="icon" onClick={() => removeCollection(c)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova coleção de flashcards</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={collectionName} onChange={e => setCollectionName(e.target.value)} placeholder="Ex: Vocabulário Unidade 1" />
            </div>
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={collectionLevel} onValueChange={setCollectionLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <VisibilitySelector value={visibility} onChange={setVisibility} classes={allClasses} currentClassName={className ?? ''} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createCollection} disabled={savingCollection} className="gradient-primary text-primary-foreground">
              {savingCollection ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
