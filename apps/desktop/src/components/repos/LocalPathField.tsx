import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocalPathField({
  path,
  inspecting,
  onPathChange,
  onBrowse,
  onInspect,
}: {
  path: string;
  inspecting: boolean;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onInspect: () => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <Label>Pasta local</Label>
      <div className="inputWithAction flex flex-wrap gap-2">
        <Input
          className="min-w-[240px] flex-1"
          value={path}
          onChange={(event) => onPathChange(event.target.value)}
          placeholder="/Users/voce/Code/meu-projeto"
        />
        <Button type="button" variant="outline" onClick={onBrowse}>
          Escolher pasta
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onInspect}
          disabled={inspecting || !path.trim()}
        >
          {inspecting ? "Detectando..." : "Detectar Git"}
        </Button>
      </div>
    </label>
  );
}
