import { supabase } from '@/integrations/supabase/client';

export type ContentType = 'material' | 'course' | 'flashcards' | 'audio_text';
export type VisibilityMode = 'class' | 'specific' | 'level';

export interface VisibilitySelection {
  mode: VisibilityMode;
  classIds: string[];
  level: string;
}

export const defaultVisibility = (): VisibilitySelection => ({ mode: 'class', classIds: [], level: 'A1' });

export async function saveContentTargets(contentType: ContentType, contentId: string, selection: VisibilitySelection) {
  if (selection.mode === 'specific') {
    if (selection.classIds.length === 0) throw new Error('Selecione ao menos uma turma');
    const { error } = await supabase.from('content_class_targets').insert(
      selection.classIds.map(classId => ({ content_type: contentType, content_id: contentId, class_id: classId }))
    );
    if (error) throw error;
  } else if (selection.mode === 'level') {
    const { error } = await supabase.from('content_level_targets').insert({
      content_type: contentType,
      content_id: contentId,
      level: selection.level,
    });
    if (error) throw error;
  }
}

/** Best-effort cleanup of any targeting rows left behind when content is deleted. */
export async function deleteContentTargets(contentType: ContentType, contentId: string) {
  await Promise.all([
    supabase.from('content_class_targets').delete().eq('content_type', contentType).eq('content_id', contentId),
    supabase.from('content_level_targets').delete().eq('content_type', contentType).eq('content_id', contentId),
  ]);
}

export interface TargetLabelInfo {
  label: string;
  classIds: string[];
  level: string | null;
}

/** Fetches admin-only targeting info for a batch of content ids, keyed by content id. */
export async function fetchTargetLabels(contentType: ContentType, ids: string[]): Promise<Map<string, TargetLabelInfo>> {
  const map = new Map<string, TargetLabelInfo>();
  if (ids.length === 0) return map;

  const [classTargetsRes, levelTargetsRes] = await Promise.all([
    supabase
      .from('content_class_targets')
      .select('content_id, class_id, teacher_classes(name)')
      .eq('content_type', contentType)
      .in('content_id', ids),
    supabase
      .from('content_level_targets')
      .select('content_id, level')
      .eq('content_type', contentType)
      .in('content_id', ids),
  ]);

  const byContentClassNames = new Map<string, string[]>();
  const byContentClassIds = new Map<string, string[]>();
  (classTargetsRes.data ?? []).forEach((row: { content_id: string; class_id: string; teacher_classes: { name: string } | null }) => {
    const names = byContentClassNames.get(row.content_id) ?? [];
    names.push(row.teacher_classes?.name ?? 'Turma');
    byContentClassNames.set(row.content_id, names);
    const classIds = byContentClassIds.get(row.content_id) ?? [];
    classIds.push(row.class_id);
    byContentClassIds.set(row.content_id, classIds);
  });

  const byContentLevel = new Map<string, string>();
  (levelTargetsRes.data ?? []).forEach((row: { content_id: string; level: string }) => {
    byContentLevel.set(row.content_id, row.level);
  });

  ids.forEach(id => {
    const level = byContentLevel.get(id);
    const classNames = byContentClassNames.get(id);
    if (level) {
      map.set(id, { label: `Nível ${level}`, classIds: [], level });
    } else if (classNames && classNames.length > 0) {
      map.set(id, {
        label: classNames.length === 1 ? classNames[0] : `${classNames.length} turmas`,
        classIds: byContentClassIds.get(id) ?? [],
        level: null,
      });
    }
  });

  return map;
}
