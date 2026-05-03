import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DOW_LABELS } from "./utils";
import type { DateRange, MenuRow } from "./types";

type Props = {
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  menuId: string | null;
  onMenuChange: (id: string | null) => void;
  dows: number[];
  onDowsChange: (d: number[]) => void;
  menus: MenuRow[];
  onReset: () => void;
};

export function FiltersBar(p: Props) {
  const [open, setOpen] = useState(false);

  const toggleDow = (d: number) => {
    p.onDowsChange(p.dows.includes(d) ? p.dows.filter((x) => x !== d) : [...p.dows, d]);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start gap-2">
            <CalendarIcon className="h-4 w-4" />
            {format(p.range.from, "dd MMM")} – {format(p.range.to, "dd MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: p.range.from, to: p.range.to }}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                p.onRangeChange({ from: r.from, to: r.to });
              }
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={p.menuId ?? "all"}
        onValueChange={(v) => p.onMenuChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Menú" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los menús</SelectItem>
          {p.menus.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {format(new Date(m.date), "dd MMM")} — {m.main_dish}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        {DOW_LABELS.map((label, i) => {
          const active = p.dows.includes(i);
          return (
            <button
              key={label}
              onClick={() => toggleDow(i)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {(p.menuId || p.dows.length > 0) && (
        <Badge variant="secondary" className="gap-1">
          {[p.menuId && "menú", p.dows.length && `${p.dows.length} días`].filter(Boolean).join(" · ")}
        </Badge>
      )}

      <Button variant="ghost" size="sm" onClick={p.onReset} className="ml-auto gap-1">
        <X className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
