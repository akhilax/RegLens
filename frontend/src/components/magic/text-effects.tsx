// Text Generate Effect — rebuilt from 21st.dev by manuarora700 (https://21st.dev/@manuarora700/components/text-generate-effect)
// Animated Gradient Text — rebuilt from 21st.dev by dillionverma (https://21st.dev/@dillionverma/components/animated-gradient-text)
// Word Rotate — rebuilt from 21st.dev by dillionverma (https://21st.dev/@dillionverma/components/word-rotate)
// Blur Fade — rebuilt from 21st.dev by dillionverma (https://21st.dev/@dillionverma/components/blur-fade)
import { AnimatePresence, m, type Variants } from "motion/react";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { ease, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function TextGenerateEffect({
  words,
  className,
  wordClassName,
  delay = 0,
}: {
  words: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const parts = words.split(" ");
  return (
    <m.span
      className={cn("inline", className)}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger.words, delayChildren: delay } } }}
      aria-label={words}
    >
      {parts.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
        <m.span
          aria-hidden
          className={cn("inline-block", wordClassName)}
          variants={{
            hidden: { opacity: 0, filter: "blur(10px)", y: 8 },
            show: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: ease.out } },
          }}
        >
          {w}
        </m.span>
        {i < parts.length - 1 ? " " : null}
        </Fragment>
      ))}
    </m.span>
  );
}

export function AnimatedGradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline animate-gradient bg-[length:var(--bg-size,300%)_100%] bg-clip-text text-transparent [--bg-size:300%]",
        "bg-[linear-gradient(90deg,var(--brand),var(--brand-2),oklch(0.78_0.14_320),var(--brand))]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function WordRotate({ words, className, interval = 2400 }: { words: string[]; className?: string; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={words[i]}
          className={cn("col-start-1 row-start-1 inline-block", className)}
          initial={{ opacity: 0, y: "60%", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: "0%", filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-60%", filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: ease.out }}
        >
          {words[i]}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

const blurFade: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export function BlurFade({
  children,
  className,
  delay = 0,
  inView = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}) {
  return (
    <m.div
      className={className}
      variants={blurFade}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-40px" } } : { animate: "show" })}
      transition={{ duration: 0.5, delay, ease: ease.out }}
    >
      {children}
    </m.div>
  );
}
