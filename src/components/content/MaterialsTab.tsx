import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Video, Upload, Trash2, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { VisibilitySelector, type ClassOption } from '@/components/content/VisibilitySelector';
import { defaultVisibility, deleteContentTargets, fetchTargetLabels, saveContentTargets, type TargetLabelInfo } from '@/lib/content-targets';

type MaterialRow = {
  id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  type: 'pdf' | 'video';
  file_url: string;
  file_size: number | null;
  created_at: string;
};

interface MaterialsTabProps {
  classId: string;
  className?: string;
  isAdmin?: boolean;
  allClasses?: ClassOption[];
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const PDF_TYPES = ['application/pdf'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function MaterialsTab({ classId, className, isAdmin = false, allClasses = [] }: MaterialsTabProps) {
  const { user } = useAuthContext();
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [targetLabels, setTargetLabels] = useState<Map<string, TargetLabelInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: idsData, error: idsError } = await supabase.rpc('visible_content_ids', {
      _content_type: 'material',
      _class_id: classId,
    });
    if (idsError) {
      toast.error(idsError.message);
      setLoading(false);
      return;
    }
    const ids = (idsData ?? []).map(r => r.content_id);
    if (ids.length === 0) {
      setMaterials([]);
      setTargetLabels(new Map());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('class_materials')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as MaterialRow[];
    setMaterials(rows);
    setLoading(false);

    if (isAdmin) {
      const nullClassRows = rows.filter(r => r.class_id === null);
      if (nullClassRows.length > 0) {
        const labels = await fetchTargetLabels('material', nullClassRows.map(r => r.id));
        setTargetLabels(labels);
      } else {
        setTargetLabels(new Map());
      }
    }
  }, [classId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFile(null);
    setVisibility(defaultVisibility());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isPdf = PDF_TYPES.includes(f.type);
    const isVideo = VIDEO_TYPES.includes(f.type);
    if (!isPdf && !isVideo) {
      toast.error('Formato não suportado. Envie um PDF ou vídeo (mp4, webm, mov, ogg).');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Limite de 100MB.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const upload = async () => {
    if (!user || !file) {
      toast.error('Selecione um arquivo');
      return;
    }
    if (!title.trim()) {
      toast.error('Informe um título');
      return;
    }
    setUploading(true);
    try {
      const type: 'pdf' | 'video' = PDF_TYPES.includes(file.type) ? 'pdf' : 'video';
      const ext = file.name.split('.').pop();
      const path = `${classId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('class-materials')
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const targeted = isAdmin && visibility.mode !== 'class';
      const { data: inserted, error: insertError } = await supabase
        .from('class_materials')
        .insert({
          class_id: targeted ? null : classId,
          title: title.trim(),
          description: description.trim() || null,
          type,
          file_url: path,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      if (targeted && inserted) {
        await saveContentTargets('material', inserted.id, visibility);
      }

      toast.success('Material adicionado');
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar material');
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (material: MaterialRow) => {
    const { data, error } = await supabase.storage
      .from('class-materials')
      .createSignedUrl(material.file_url, 60 * 10);
    if (error || !data) {
      toast.error('Não foi possível abrir o arquivo');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const removeMaterial = async (material: MaterialRow) => {
    const ok = window.confirm(`Excluir o material "${material.title}"?`);
    if (!ok) return;
    try {
      await supabase.storage.from('class-materials').remove([material.file_url]);
      const { error } = await supabase.from('class_materials').delete().eq('id', material.id);
      if (error) throw error;
      await deleteContentTargets('material', material.id);
      toast.success('Material removido');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir material');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">PDFs e vídeos de apoio para esta turma</p>
        <Button
          size="sm"
          className="gap-2 gradient-primary text-primary-foreground"
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          <Upload className="h-4 w-4" />
          Enviar material
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h3 className="font-semibold text-foreground">Nenhum material ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">Envie PDFs ou vídeos de apoio para os alunos desta turma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {m.type === 'pdf' ? <FileText className="h-5 w-5 text-primary" /> : <Video className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{m.title}</p>
                  {isAdmin && m.class_id === null && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {targetLabels.get(m.id)?.label ?? 'Todas as turmas'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {m.description || (m.type === 'pdf' ? 'PDF' : 'Vídeo')} {m.file_size ? `· ${formatSize(m.file_size)}` : ''}
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={() => openFile(m)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => removeMaterial(m)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo material</DialogTitle>
            <DialogDescription>Envie um PDF ou vídeo de apoio (até 100MB).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input ref={fileInputRef} type="file" accept=".pdf,video/mp4,video/webm,video/quicktime,video/ogg" onChange={handleFileChange} />
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Apostila Unidade 1" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" rows={3} />
            </div>
            {isAdmin && (
              <VisibilitySelector value={visibility} onChange={setVisibility} classes={allClasses} currentClassName={className ?? ''} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={upload} disabled={uploading} className="gradient-primary text-primary-foreground">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
