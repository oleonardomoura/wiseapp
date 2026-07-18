import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, HelpCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractMentions } from '@/lib/mentions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X as CloseIcon } from 'lucide-react';

type PostTag = 'question' | 'tip' | null;

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPostCreated: () => void;
}

export default function CreatePostDialog({ open, onOpenChange, userId, onPostCreated }: CreatePostDialogProps) {
  const { profile } = useAuthContext();
  const [content, setContent] = useState('');
  const [tag, setTag] = useState<PostTag>(null);
  const [loading, setLoading] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 3) {
      toast.error('O post precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (trimmed.length > 500) {
      toast.error('O post não pode ter mais de 500 caracteres.');
      return;
    }

    setLoading(true);
    const mentions = extractMentions(content);
    const finalContent = tag === 'question' ? `❓ ${trimmed}` : tag === 'tip' ? `💡 ${trimmed}` : trimmed;

    let imageUrl = null;

    // DEV BYPASS: avoid foreign key/uuid errors on mock user
    if (userId === 'dev-user-id') {
      setTimeout(() => {
        setLoading(false);
        toast.success('Post publicado! (modo dev)');
        setContent('');
        setTag(null);
        setSelectedImage(null);
        setImagePreview(null);
        onOpenChange(false);
        onPostCreated();
      }, 1000);
      return;
    }

    try {
      // 1. Upload image if exists
      if (selectedImage) {
        setUploadingImage(true);
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('community-posts')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('community-posts')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      // 2. Insert post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({ 
          content: finalContent, 
          user_id: userId,
          image_url: imageUrl 
        })
        .select()
        .single();

      if (postError) throw postError;

      // 3. Handle mentions notifications
      if (mentions.length > 0) {
        const { data: targetProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('username', mentions);

        if (targetProfiles && targetProfiles.length > 0) {
          const notifications = targetProfiles
            .filter(p => p.id !== userId)
            .map(p => ({
              user_id: p.id,
              type: 'mention',
              title: 'Você foi mencionado!',
              message: `${profile?.full_name || 'Alguém'} mencionou você em um post.`,
              data: { post_id: post.id }
            }));

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }
        }
      }

      toast.success('Post publicado!');
      setContent('');
      setTag(null);
      setSelectedImage(null);
      setImagePreview(null);
      onOpenChange(false);
      onPostCreated();
    } catch (err: any) {
      toast.error('Erro ao publicar: ' + err.message);
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    // Validate type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Formato inválido. Use JPG, JPEG ou PNG.');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tag toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => setTag(tag === 'question' ? null : 'question')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                tag === 'question'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" /> Dúvida
            </button>
            <button
              onClick={() => setTag(tag === 'tip' ? null : 'tip')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                tag === 'tip'
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'border-border text-muted-foreground hover:border-accent/50'
              )}
            >
              <Lightbulb className="h-3.5 w-3.5" /> Dica de Estudo
            </button>
          </div>

          <div className="relative">
            <Textarea
              placeholder="O que você quer compartilhar com a comunidade?"
              value={content}
              onChange={e => {
                const val = e.target.value;
                setContent(val);
                
                const pos = e.target.selectionStart;
                setCursorPos(pos);

                const beforeCursor = val.slice(0, pos);
                const words = beforeCursor.split(/\s/);
                const lastWord = words[words.length - 1];

                if (lastWord.startsWith('@')) {
                  const query = lastWord.slice(1);
                  setMentionSearch(query);
                  setShowMentions(true);
                  
                  let dbQuery = supabase.from('profiles')
                    .select('id, full_name, username, avatar_url')
                    .limit(5);

                  if (query.length > 0) {
                    dbQuery = dbQuery.ilike('username', `%${query}%`);
                  } else {
                    dbQuery = dbQuery.not('username', 'is', null).order('full_name');
                  }

                  dbQuery.then(({ data }) => {
                    if (!data || data.length === 0) {
                      // Fallback with mock users for testing
                      const mocks = [
                        { id: 'm1', full_name: 'Ana Silva', username: '@ana_silva', avatar_url: null },
                        { id: 'm2', full_name: 'João Pedro', username: '@joao_p', avatar_url: null },
                        { id: 'm3', full_name: 'Maria Oliveira', username: '@maria_oli', avatar_url: null },
                      ];
                      setMentionUsers(mocks.filter(m => m.username.includes(query.toLowerCase())));
                    } else {
                      setMentionUsers(data);
                    }
                  });
                } else {
                  setShowMentions(false);
                }
              }}
              rows={5}
              maxLength={500}
              className="resize-none"
            />

            {showMentions && mentionUsers.length > 0 && (
              <div className="absolute z-50 bottom-full left-0 mb-2 w-full max-w-[280px] rounded-lg border border-border bg-card shadow-lg p-1 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Mencionar Alguém</div>
                <div className="max-h-48 overflow-y-auto">
                  {mentionUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        const before = content.slice(0, cursorPos);
                        const after = content.slice(cursorPos);
                        const words = before.split(/\s/);
                        words[words.length - 1] = u.username;
                        const newContent = words.join(' ') + ' ' + after;
                        setContent(newContent);
                        setShowMentions(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-primary/5 text-left transition-colors group"
                    >
                      <Avatar className="h-7 w-7 border border-border group-hover:border-primary/20">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                          {(u.full_name ?? '?').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {imagePreview && (
            <div className="relative rounded-lg overflow-hidden border border-border group animate-in fade-in zoom-in-95">
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                title="Remover imagem"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="post-image"
                className="hidden"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleImageSelect}
              />
              <label
                htmlFor="post-image"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer",
                  selectedImage 
                    ? "bg-primary/5 border-primary/30 text-primary" 
                    : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {selectedImage ? 'Alterar Foto' : 'Adicionar Foto'}
              </label>
            </div>
            <span className="text-xs text-muted-foreground">{content.length}/500</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || content.trim().length < 3}>
            {loading ? 'Publicando...' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
