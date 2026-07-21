import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VisibilitySelection } from '@/lib/content-targets';

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ClassOption = { id: string; name: string; level: string; teacher_name?: string };

export function VisibilitySelector({
  value,
  onChange,
  classes,
  currentClassName,
}: {
  value: VisibilitySelection;
  onChange: (v: VisibilitySelection) => void;
  classes: ClassOption[];
  currentClassName: string;
}) {
  const toggleClass = (id: string) => {
    const set = new Set(value.classIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ ...value, classIds: Array.from(set) });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Label>Visibilidade</Label>
      <RadioGroup value={value.mode} onValueChange={(mode) => onChange({ ...value, mode: mode as VisibilitySelection['mode'] })}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="class" id="vis-class" />
          <Label htmlFor="vis-class" className="font-normal cursor-pointer">Apenas {currentClassName || 'a turma selecionada'}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="specific" id="vis-specific" />
          <Label htmlFor="vis-specific" className="font-normal cursor-pointer">Turmas específicas</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="level" id="vis-level" />
          <Label htmlFor="vis-level" className="font-normal cursor-pointer">Todas as turmas de um nível</Label>
        </div>
      </RadioGroup>

      {value.mode === 'specific' && (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
          {classes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma turma disponível.</p>
          ) : (
            classes.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`class-${c.id}`}
                  checked={value.classIds.includes(c.id)}
                  onCheckedChange={() => toggleClass(c.id)}
                />
                <Label htmlFor={`class-${c.id}`} className="font-normal cursor-pointer text-sm">
                  {c.name} · {c.level}{c.teacher_name ? ` · ${c.teacher_name}` : ''}
                </Label>
              </div>
            ))
          )}
        </div>
      )}

      {value.mode === 'level' && (
        <Select value={value.level} onValueChange={(level) => onChange({ ...value, level })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
