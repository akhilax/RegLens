import { m, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Cpu,
  FileSearch,
  GitCompareArrows,
  Link2,
  ListChecks,
  type LucideIcon,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { type RefObject, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { RiskBadge, RuleChip } from "@/components/app/badges";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { AnimatedBeam } from "@/components/magic/animated-beam";
import { AuroraBackground } from "@/components/magic/aurora-background";
import { DotPattern, Spotlight } from "@/components/magic/backgrounds";
import { BentoCard, BentoGrid } from "@/components/magic/bento-grid";
import { BorderBeam } from "@/components/magic/border-beam";
import { Marquee } from "@/components/magic/marquee";
import { Particles } from "@/components/magic/particles";
import { ShimmerButton } from "@/components/magic/shimmer-button";
import { AnimatedGradientText, BlurFade, TextGenerateEffect, WordRotate } from "@/components/magic/text-effects";
import { Button } from "@/components/ui/button";
import { fadeUp, spring, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

const PIPELINE: { key: string; label: string; icon: LucideIcon; note: string }[] = [
  { key: "txn", label: "Transaction", icon: Receipt, note: "Features computed, PII masked" },
  { key: "rules", label: "Rules", icon: ListChecks, note: "Deterministic thresholds" },
  { key: "rag", label: "RAG", icon: FileSearch, note: "BM25 + vectors, RRF fused" },
  { key: "llm", label: "LLM", icon: Bot, note: "Strict JSON reasoning" },
  { key: "guard", label: "Guardrail", icon: ShieldAlert, note: "Citations must be retrieved" },
  { key: "human", label: "Human", icon: UserCheck, note: "Four-eyes for STR" },
  { key: "audit", label: "Audit", icon: Link2, note: "Hash-chained, tamper-evident" },
];

const REGS = [
  "PMLA 2002",
  "PML (Maintenance of Records) Rules 2005",
  "RBI KYC Master Direction",
  "Income-tax Act 2025",
  "FEMA · LRS",
  "FATF High-Risk Jurisdictions",
  "FIU-IND CTR · STR · CBWTR · NTR",
];

function Pipeline() {
  const container = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const nodeRefs = PIPELINE.map((_, i) => ({ get current() { return refs.current[i]; } }) as RefObject<HTMLDivElement | null>);

  return (
    <div ref={container} className="relative mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-7 lg:gap-6">
      {PIPELINE.map((step, i) => (
        <m.div
          key={step.key}
          ref={(el: HTMLDivElement | null) => {
            refs.current[i] = el;
          }}
          variants={fadeUp}
          whileHover={{ y: -4, transition: spring.snappy }}
          className="relative z-10 mx-auto flex w-full max-w-[220px] flex-col items-center gap-2 rounded-2xl border border-border bg-card/80 p-4 text-center shadow-soft backdrop-blur-xl"
        >
          <div className="grid size-11 place-items-center rounded-xl border border-border-strong bg-background shadow-[0_0_24px_-6px_var(--brand-glow)]">
            <step.icon className="size-5 text-brand" aria-hidden />
          </div>
          <div className="text-sm font-semibold">{step.label}</div>
          <div className="text-[11px] leading-4 text-muted-foreground">{step.note}</div>
          <span className="absolute -top-2.5 left-3 rounded-full border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
        </m.div>
      ))}
      {PIPELINE.slice(0, -1).map((step, i) => (
        <AnimatedBeam
          key={step.key}
          containerRef={container}
          fromRef={nodeRefs[i]}
          toRef={nodeRefs[i + 1]}
          delay={i * 0.35}
          duration={2.8}
          curvature={i % 2 ? 18 : -18}
        />
      ))}
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative rounded-2xl border border-border-strong bg-card/80 p-4 text-left shadow-lift backdrop-blur-2xl sm:p-5">
      <BorderBeam size={180} duration={9} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground">T00412 · cash credit</span>
          <RiskBadge level="high" />
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Decision #318</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">₹9,80,000</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">3rd deposit at 98% of ₹10L in 5 days</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <RuleChip id="R-STRUCT" />
        <RuleChip id="R-CTR" />
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {[
          ["PML-RULES-2005@v1#rule3-1-d", true],
          ["PML-RULES-2005@v1#rule8-2", true],
          ["PML-RULES-2005@v1#sec-42-hallucinated", false],
        ].map(([id, ok]) => (
          <div key={String(id)} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
            {ok ? <ShieldCheck className="size-3.5 text-risk-low" /> : <ShieldAlert className="size-3.5 text-risk-high" />}
            <span className={cn("min-w-0 truncate font-mono", !ok && "text-muted-foreground line-through")}>{id}</span>
            {!ok && <span className="ml-auto shrink-0 rounded bg-risk-high-bg px-1.5 text-[10px] text-risk-high">stripped</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-accent/40 px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          <Users className="size-3.5 text-brand" /> STR candidate · needs 2 approvers
        </span>
        <span className="font-mono text-brand">1 / 2</span>
      </div>
    </div>
  );
}

const FEATURES: { title: string; body: string; icon: LucideIcon; className: string }[] = [
  { title: "Hybrid reasoning", body: "Rules own every threshold and deadline. The LLM explains applicability — it never invents a number.", icon: Cpu, className: "md:col-span-3" },
  { title: "Citation guardrail", body: "Every regulation the model cites must be a chunk retrieved for that request. Hallucinated citations are stripped and routed to a human.", icon: ShieldAlert, className: "md:col-span-3" },
  { title: "Four-eyes approval", body: "Nothing becomes reportable without a human. STR candidates need two distinct reviewers.", icon: Users, className: "md:col-span-2" },
  { title: "Tamper-evident audit", body: "Analyses, reviews and KB changes are hash-chained. One edited byte breaks the chain.", icon: Link2, className: "md:col-span-2" },
  { title: "Regulation change impact", body: "Upload a new version, see the clause diff and every decision that cited a superseded clause.", icon: GitCompareArrows, className: "md:col-span-2" },
  { title: "Runs fully offline", body: "A deterministic mock LLM, local embeddings and SQLite. Plug in Claude or Ollama with one env var.", icon: WifiOff, className: "md:col-span-3" },
  { title: "Traceable knowledge base", body: "Section-aware chunks with stable IDs, SHA-256 hashes and versions — every answer points to a clause.", icon: BookOpenCheck, className: "md:col-span-3" },
];

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const previewRotate = useTransform(scrollYProgress, [0, 1], [8, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="glass fixed inset-x-0 top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Landing">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#coverage" className="transition-colors hover:text-foreground">Coverage</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to="/app">
                Launch Console <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <AuroraBackground>
        <section ref={heroRef} className="relative overflow-hidden pb-20 pt-28 sm:pt-36">
          <Spotlight className="-left-20 -top-40 md:-left-10 md:-top-20" />
          <Particles quantity={80} />
          <DotPattern className="[mask-image:radial-gradient(ellipse_at_top,white,transparent_65%)]" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <m.div style={{ opacity: heroOpacity }} className="min-w-0 text-center lg:text-left">
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-card/60 px-3 py-1 text-xs backdrop-blur lg:mx-0"
              >
                <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]" />
                <AnimatedGradientText className="font-medium">Traceable RAG · Human-approved · Offline-first</AnimatedGradientText>
              </m.div>
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
                <TextGenerateEffect words="Every compliance decision," />{" "}
                <TextGenerateEffect words="traced to the clause." delay={0.35} wordClassName="text-gradient pb-1" />
              </h1>
              <m.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg lg:mx-0"
              >
                RegLens reads every transaction, decides which Indian AML, KYC, tax and FEMA rules apply, and drafts{" "}
                <WordRotate words={["CTRs", "STRs", "CBWTRs", "NTRs", "EDD tasks", "KYC updates"]} className="font-semibold text-foreground" />{" "}
                — with a citation for every claim and a human for every decision that matters.
              </m.p>
              <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              >
                <ShimmerButton onClick={() => navigate("/app")} className="text-[15px]">
                  Launch Console <ArrowRight className="size-4" />
                </ShimmerButton>
                <Button variant="outline" size="lg" asChild className="rounded-full">
                  <a href="#how">See the pipeline</a>
                </Button>
              </m.div>
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring.gentle, delay: 0.5 }}
              style={{ y: previewY, rotateX: previewRotate, transformPerspective: 1200 }}
              className="mx-auto w-full min-w-0 max-w-md"
            >
              <HeroPreview />
            </m.div>
          </div>
        </section>
      </AuroraBackground>

      <section id="coverage" className="border-y border-border bg-card/30 py-6">
        <Marquee className="mask-fade-x" duration={35}>
          {REGS.map((r) => (
            <span key={r} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm text-muted-foreground">
              <BookOpenCheck className="size-4 text-brand" aria-hidden /> {r}
            </span>
          ))}
        </Marquee>
      </section>

      <section id="how" className="relative py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Seven steps. Every one recorded.</h2>
            <p className="mt-3 text-muted-foreground">
              A transaction flows through deterministic rules, hybrid retrieval and a constrained LLM, then a guardrail
              and a human — and every hop lands in a hash-chained audit trail.
            </p>
          </BlurFade>
          <m.div variants={staggerContainer(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
            <Pipeline />
          </m.div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <BlurFade className="mb-10 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Built for audit, not for demos</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Trust is a feature you can verify.</h2>
          </BlurFade>
          <BentoGrid inView>
            {FEATURES.map((f) => (
              <BentoCard key={f.title} className={f.className}>
                <div className="flex h-full flex-col gap-3 p-6">
                  <div className="grid size-10 place-items-center rounded-xl border border-border-strong bg-background">
                    <f.icon className="size-5 text-brand" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </div>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_100%,var(--brand-glow),transparent)]" aria-hidden />
        <BlurFade className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See it on 600 synthetic transactions.</h2>
          <p className="mt-3 text-muted-foreground">No API key needed. Everything runs locally in mock mode.</p>
          <div className="mt-8 flex justify-center">
            <ShimmerButton onClick={() => navigate("/app")}>
              Launch Console <ArrowRight className="size-4" />
            </ShimmerButton>
          </div>
        </BlurFade>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p className="max-w-xl text-center sm:text-right">
            Educational hackathon prototype — not legal advice. Regulatory summaries are paraphrased and must be verified
            against official sources.
          </p>
        </div>
      </footer>
    </div>
  );
}
