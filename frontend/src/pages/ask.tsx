import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, m } from "motion/react";
import { ArrowUp, Bot, FileText, ShieldAlert, Sparkles, User } from "lucide-react";
import { type FormEvent, Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { api, type RetrievedChunk } from "@/api/client";
import { PageHeader } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Badge, Card, Textarea } from "@/components/ui/primitives";
import { fadeUp, spring, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  chunks?: RetrievedChunk[];
  valid?: string[];
  invalid?: string[];
  streaming?: boolean;
  model?: string;
}

const CITE = /\[([A-Z0-9-]+@v\d+#[a-z0-9-]+)\]/g;

function CitationChip({ id, chunk, msgId }: { id: string; chunk?: RetrievedChunk; msgId: number }) {
  const [open, setOpen] = useState(false);
  const valid = !!chunk;
  return (
    <span className="inline-block align-baseline">
      <m.button
        layout
        layoutId={`cite-${msgId}-${id}`}
        onClick={() => valid && setOpen((o) => !o)}
        transition={spring.snappy}
        aria-expanded={open}
        className={cn(
          "mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-px font-mono text-[10.5px] align-baseline",
          valid ? "border-brand/40 bg-accent text-accent-foreground hover:border-brand" : "border-risk-high/40 bg-risk-high-bg text-risk-high line-through",
        )}
        title={valid ? "Show source clause" : "Not in retrieved set — removed by guardrail"}
      >
        {valid ? <FileText className="size-3" /> : <ShieldAlert className="size-3" />}
        {id.split("#")[1]}
      </m.button>
      <AnimatePresence>
        {open && chunk && (
          <m.span
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={spring.gentle}
            className="my-2 block overflow-hidden rounded-xl border border-border bg-background/70 p-3 text-xs not-italic"
          >
            <span className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="mono">{chunk.reg_id}</Badge>
              <Badge>v{chunk.version}</Badge>
              <span className="font-medium text-foreground">{chunk.heading}</span>
            </span>
            <span className="block leading-relaxed text-muted-foreground">{chunk.text}</span>
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Tiny renderer: **bold**, _italic_, line breaks, and [chunk-id] → citation chip. */
function RichText({ msg }: { msg: Msg }) {
  const byId = new Map((msg.chunks ?? []).map((c) => [c.chunk_id, c]));
  const renderInline = (line: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    let last = 0;
    for (const match of line.matchAll(CITE)) {
      out.push(<Fragment key={`${key}-t${last}`}>{fmt(line.slice(last, match.index))}</Fragment>);
      out.push(<CitationChip key={`${key}-c${match.index}`} id={match[1]} chunk={byId.get(match[1])} msgId={msg.id} />);
      last = (match.index ?? 0) + match[0].length;
    }
    out.push(<Fragment key={`${key}-end`}>{fmt(line.slice(last))}</Fragment>);
    return out;
  };
  const fmt = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
      p.startsWith("**") ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong> : p.startsWith("_") && p.endsWith("_") ? <em key={i} className="text-muted-foreground">{p.slice(1, -1)}</em> : p,
    );
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {msg.text.split(/\n\n+/).map((para, i) => (
        <p key={i}>{renderInline(para, `p${i}`)}</p>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <m.span key={i} className="size-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

export default function Ask() {
  const { data: suggestions } = useQuery({ queryKey: ["suggestions"], queryFn: api.suggestions, staleTime: Infinity });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => () => esRef.current?.close(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const uid = ++idRef.current;
    const aid = ++idRef.current;
    setMsgs((m) => [...m, { id: uid, role: "user", text: question }, { id: aid, role: "assistant", text: "", streaming: true }]);
    setInput("");
    setBusy(true);
    const update = (fn: (m: Msg) => Msg) => setMsgs((all) => all.map((x) => (x.id === aid ? fn(x) : x)));
    const es = new EventSource(api.sseUrl(`/qa/stream?q=${encodeURIComponent(question)}`));
    esRef.current = es;
    es.onmessage = (ev) => {
      const e = JSON.parse(ev.data);
      if (e.type === "retrieved") update((x) => ({ ...x, chunks: e.chunks, model: e.model }));
      else if (e.type === "token") update((x) => ({ ...x, text: x.text + e.text }));
      else if (e.type === "done") {
        update((x) => ({ ...x, streaming: false, valid: e.citations, invalid: e.invalid_citations }));
        es.close();
        setBusy(false);
      }
    };
    es.onerror = () => {
      es.close();
      update((x) => ({ ...x, streaming: false, text: x.text || "Sorry — the RegLens API is not reachable. Is `npm run dev` running?" }));
      setBusy(false);
    };
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col">
      <PageHeader eyebrow="RAG Q&A" title="Ask the regulations" description="Answers are grounded only in retrieved clauses. Every claim carries a citation you can expand; citations that weren't retrieved are struck out." />
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {msgs.length === 0 ? (
            <m.div variants={staggerContainer(0.06)} initial="hidden" animate="show" className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
              <m.div variants={fadeUp} className="grid size-14 place-items-center rounded-2xl border border-border-strong bg-card shadow-[0_0_40px_-8px_var(--brand-glow)]">
                <Sparkles className="size-6 text-brand" />
              </m.div>
              <m.div variants={fadeUp}>
                <h2 className="text-lg font-semibold">What do you want to know?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Try one of these — or ask anything about CTR, STR, KYC, LRS, PEPs or cash rules.</p>
              </m.div>
              <m.div variants={staggerContainer(0.05)} className="flex flex-wrap justify-center gap-2">
                {(suggestions ?? []).map((s) => (
                  <m.button key={s} variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => ask(s)} className="rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground">
                    {s}
                  </m.button>
                ))}
              </m.div>
            </m.div>
          ) : (
            <LayoutGroup>
              <div className="mx-auto max-w-3xl space-y-5">
                <AnimatePresence initial={false}>
                  {msgs.map((msg) => (
                    <m.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                      <div className={cn("grid size-8 shrink-0 place-items-center rounded-full", msg.role === "user" ? "bg-accent" : "bg-brand text-white")}>
                        {msg.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                      </div>
                      <div className={cn("min-w-0 max-w-[85%] rounded-2xl px-4 py-3", msg.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card/80")}>
                        {msg.role === "user" ? (
                          <p className="text-sm">{msg.text}</p>
                        ) : msg.text ? (
                          <>
                            <RichText msg={msg} />
                            {msg.streaming && <m.span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm bg-brand" animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />}
                            {!msg.streaming && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                                <span>{msg.valid?.length ?? 0} citation(s) verified</span>
                                {!!msg.invalid?.length && <Badge variant="high"><ShieldAlert />{msg.invalid.length} not retrieved</Badge>}
                                <span className="ml-auto font-mono">{msg.model}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <TypingDots />
                        )}
                      </div>
                    </m.div>
                  ))}
                </AnimatePresence>
                <div ref={endRef} />
              </div>
            </LayoutGroup>
          )}
        </div>
        <form onSubmit={submit} className="border-t border-border p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about a regulation… (Enter to send)"
              className="min-h-11 resize-none"
              aria-label="Your question"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send" className="size-11 rounded-xl">
              <ArrowUp />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
