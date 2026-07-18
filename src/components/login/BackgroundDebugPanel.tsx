import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  repelRadius: number;
  setRepelRadius: (value: number) => void;
  repelStrength: number;
  setRepelStrength: (value: number) => void;
  blobScale: number;
  setBlobScale: (value: number) => void;
  className?: string;
};

export function BackgroundDebugPanel({
  repelRadius,
  setRepelRadius,
  repelStrength,
  setRepelStrength,
  blobScale,
  setBlobScale,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/80 p-4 shadow-sm backdrop-blur-md",
        className
      )}
    >
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">Background debug</p>
        <p className="text-xs text-muted-foreground">Ajuste visual (somente quando ?bgdebug=1)</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">Repel radius</Label>
            <span className="tabular-nums text-xs text-foreground">{Math.round(repelRadius)}</span>
          </div>
          <Slider
            value={[repelRadius]}
            min={60}
            max={420}
            step={5}
            onValueChange={([v]) => setRepelRadius(v ?? 190)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">Repel strength</Label>
            <span className="tabular-nums text-xs text-foreground">{Math.round(repelStrength)}</span>
          </div>
          <Slider
            value={[repelStrength]}
            min={0}
            max={900}
            step={10}
            onValueChange={([v]) => setRepelStrength(v ?? 340)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-muted-foreground">Blob scale</Label>
            <span className="tabular-nums text-xs text-foreground">{blobScale.toFixed(2)}×</span>
          </div>
          <Slider
            value={[blobScale]}
            min={0.55}
            max={1.6}
            step={0.05}
            onValueChange={([v]) => setBlobScale(v ?? 1)}
          />
        </div>
      </div>
    </div>
  );
}
