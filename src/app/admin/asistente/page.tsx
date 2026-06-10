import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Sparkles, Check, X, ShieldAlert, User2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Pending = {
  tool_call_id: string;
  kind: string;
  params: Record<string, unknown>;
  summary: string;
};

type ServerMessage = {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

const QUICK_PROMPTS = [
  "¿Qué comedor está peor evaluado esta semana y por qué?",
  "Lista las preguntas activas en cada comedor",
  "Genera un resumen de los últimos 14 días por comedor",
  "Apaga las preguntas que no tengan ningún comedor asignado",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function callAssistant(messages: ServerMessage[]): Promise<{
  status: "done" | "pending_approval";
  messages: ServerMessage[];
  pending?: Pending | Pending[];
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token ?? PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function applyMutations(
  pending: Pending[],
): Promise<Array<{ tool_call_id?: string; kind: string; ok: boolean; result?: unknown; error?: string }>> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-assistant-apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token ?? PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ pending }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || `HTTP ${resp.status}`);
  return body.results ?? [];
}

export default function AsistentePage() {
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, pending]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const setPendingFromResponse = useCallback(
    (p: Pending | Pending[] | undefined) => {
      if (!p) {
        setPending([]);
        return;
      }
      setPending(Array.isArray(p) ? p : [p]);
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading) return;
      const nextMessages: ServerMessage[] = [...messages, { role: "user", content: t }];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);
      try {
        const res = await callAssistant(nextMessages);
        setMessages(res.messages);
        if (res.status === "pending_approval") setPendingFromResponse(res.pending);
        else setPending([]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
        setTimeout(() => taRef.current?.focus(), 0);
      }
    },
    [messages, loading, setPendingFromResponse],
  );

  const handleApproveAll = async () => {
    if (pending.length === 0) return;
    setApplying(true);
    try {
      const results = await applyMutations(pending);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      if (failed === 0) toast.success(`${ok} ${ok === 1 ? "acción aplicada" : "acciones aplicadas"}`);
      else toast.warning(`${ok} aplicadas, ${failed} con error`);

      const toolMessages: ServerMessage[] = results.map((r) => ({
          role: "tool",
        tool_call_id: r.tool_call_id,
        content: JSON.stringify(
          r.ok ? { approved: true, result: r.result } : { approved: true, error: r.error },
        ),
      }));
      const updated: ServerMessage[] = [...messages, ...toolMessages];
      setPending([]);
      setLoading(true);
      const res = await callAssistant(updated);
      setMessages(res.messages);
      if (res.status === "pending_approval") setPendingFromResponse(res.pending);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
      setLoading(false);
    }
  };

  const handleRejectAll = async () => {
    if (pending.length === 0) return;
    const toolMessages: ServerMessage[] = pending.map((p) => ({
        role: "tool",
      tool_call_id: p.tool_call_id,
        content: JSON.stringify({ approved: false, reason: "El admin rechazó la acción." }),
    }));
    const updated: ServerMessage[] = [...messages, ...toolMessages];
    setPending([]);
    setLoading(true);
    try {
      const res = await callAssistant(updated);
      setMessages(res.messages);
      if (res.status === "pending_approval") setPendingFromResponse(res.pending);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectOne = (tool_call_id: string) => {
    setPending((prev) => prev.filter((p) => p.tool_call_id !== tool_call_id));
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const visibleMessages = messages.filter((m) => m.role !== "tool");
  const hasPending = pending.length > 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Asistente IA</h1>
          <p className="text-sm text-muted-foreground">
            Pídele que liste, edite, prenda o apague preguntas, genere insights o gestione comedores.
            Toda mutación pedirá tu aprobación.
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        {visibleMessages.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Sparkles className="h-10 w-10 text-brand" />
            <p className="text-base font-medium">¿En qué te ayudo hoy?</p>
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="rounded-xl border border-border bg-background p-3 text-left text-sm text-foreground/80 transition hover:border-brand/40 hover:bg-foreground/5"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {hasPending && (
          <ApprovalStack
            pending={pending}
            applying={applying}
            onApproveAll={handleApproveAll}
            onRejectAll={handleRejectAll}
            onRejectOne={handleRejectOne}
          />
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <Textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Escribe tu pregunta o instrucción..."
          rows={2}
          className="resize-none border-0 bg-transparent p-2 text-base shadow-none focus-visible:ring-0"
          disabled={loading || hasPending}
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
          <Button
            onClick={() => void send(input)}
            disabled={loading || !input.trim() || hasPending}
            size="sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-2">Enviar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ServerMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl bg-brand px-4 py-2.5 text-brand-foreground">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User2 className="h-4 w-4" />
        </div>
      </div>
    );
  }
  // assistant
  const tools = message.tool_calls ?? [];
  const text = (message.content ?? "").trim();
  if (!text && tools.length === 0) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tools.map((t) => (
              <Badge key={t.id} variant="secondary" className="text-xs">
                {t.function?.name}
              </Badge>
            ))}
          </div>
        )}
        {text && (
          <div className={cn("prose prose-sm max-w-none text-foreground", "prose-headings:font-semibold prose-strong:text-foreground prose-li:my-0.5")}>
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  pending,
  applying,
  onApprove,
  onReject,
}: {
  pending: Pending;
  applying: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="ml-11 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            El asistente quiere ejecutar una acción
          </p>
          <p className="mt-1 text-sm text-foreground/80">{pending.summary}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Ver detalles técnicos ({pending.kind})
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs">
              {JSON.stringify(pending.params, null, 2)}
            </pre>
          </details>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onReject} disabled={applying}>
          <X className="mr-1 h-4 w-4" /> Rechazar
        </Button>
        <Button size="sm" onClick={onApprove} disabled={applying}>
          {applying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          Aprobar y ejecutar
        </Button>
      </div>
    </div>
  );
}