import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { renderContentWithMentions, extractMentions } from '@/lib/mentions';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; cefr_level: string | null; username: string | null };
}

interface CommentsSectionProps {
  postId: string;
  currentUserId: string;
  onCountChange?: (count: number) => void;
}

export default function CommentsSection({ postId, currentUserId, onCountChange }: CommentsSectionProps) {
  const { profile: currentUserProfile } = useAuthContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  const [cursorPos, setCursorPos] = useState(0);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch profiles for comments
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, cefr_level, username')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? []);
      const enriched = data.map(c => ({ ...c, profile: profileMap.get(c.user_id) ?? undefined }));
      setComments(enriched);
      onCountChange?.(enriched.length);
    }
  };

  useEffect(() => { fetchComments(); }, [postId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;

    setLoading(true);
    const mentions = extractMentions(text);

    const { data: comment, error } = await supabase.from('comments').insert({
      content: trimmed,
      post_id: postId,
      user_id: currentUserId,
    }).select().single();

    if (error) {
      setLoading(false);
      toast.error('Erro ao comentar.');
      return;
    }

    // Handle mentions notifications
    if (mentions.length > 0) {
      const { data: targetProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('username', mentions);

      if (targetProfiles && targetProfiles.length > 0) {
        const notifications = targetProfiles
          .filter(p => p.id !== currentUserId)
          .map(p => ({
            user_id: p.id,
            type: 'mention',
            title: 'Você foi mencionado!',
            message: `${currentUserProfile?.full_name || 'Alguém'} mencionou você em um comentário.`,
            data: { post_id: postId, comment_id: comment.id }
          }));

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
        }
      }
    }

    setLoading(false);
    setText('');
    fetchComments();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('comments').delete().eq('id', id);
    fetchComments();
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      {comments.map(c => (
        <div key={c.id} className="flex gap-2.5 group">
          <Avatar className="h-7 w-7 mt-0.5">
            <AvatarFallback className="bg-secondary text-[10px]">
              {(c.profile?.full_name ?? '?').charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">{c.profile?.full_name ?? 'Anônimo'}</span>
              {c.profile?.username && (
                <span className="text-[10px] font-mono text-muted-foreground opacity-70">
                  {c.profile.username}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed">
              {renderContentWithMentions(c.content)}
            </div>
          </div>
          {c.user_id === currentUserId && (
            <button
              onClick={() => handleDelete(c.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-2 relative">
        <Input
          placeholder="Escreva um comentário..."
          value={text}
          onChange={e => {
            const val = e.target.value;
            setText(val);
            
            const pos = e.target.selectionStart || 0;
            setCursorPos(pos);

            const beforeCursor = val.slice(0, pos);
            const words = beforeCursor.split(/\s/);
            const lastWord = words[words.length - 1];

            if (lastWord.startsWith('@')) {
              const query = lastWord.slice(1);
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
          maxLength={500}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="h-9 text-sm"
        />

        {showMentions && mentionUsers.length > 0 && (
          <div className="absolute z-50 bottom-full left-0 mb-2 w-full max-w-[240px] rounded-lg border border-border bg-card shadow-lg p-1 animate-in fade-in slide-in-from-bottom-2">
            <div className="max-h-48 overflow-y-auto">
              {mentionUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    const before = text.slice(0, cursorPos);
                    const after = text.slice(cursorPos);
                    const words = before.split(/\s/);
                    words[words.length - 1] = u.username;
                    const newText = words.join(' ') + ' ' + after;
                    setText(newText);
                    setShowMentions(false);
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-primary/5 text-left transition-colors group"
                >
                  <Avatar className="h-6 w-6 border border-border group-hover:border-primary/20">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                      {(u.full_name ?? '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-foreground truncate">{u.full_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono">{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button size="sm" variant="ghost" onClick={handleSend} disabled={loading || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
