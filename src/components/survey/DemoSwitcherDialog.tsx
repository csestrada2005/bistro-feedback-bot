import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Comedor = { id: string; slug: string; nombre: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentId: string;
  comedores: Comedor[];
  onSelect: (c: Comedor) => void;
};

export default function DemoSwitcherDialog({
  open,
  onOpenChange,
  currentId,
  comedores,
  onSelect,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modo demo</DialogTitle>
          <DialogDescription>
            Cambia de comedor para presentaciones. Esto reiniciará la encuesta actual.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {comedores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : (
            comedores.map((c) => (
              <Button
                key={c.id}
                variant={c.id === currentId ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => onSelect(c)}
              >
                {c.nombre}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}