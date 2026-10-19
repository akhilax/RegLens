import type { Transition, Variants } from "motion/react";

/** Shared motion presets — see DESIGN.md "Motion principles". */
export const spring = {
  snappy: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 },
  gentle: { type: "spring", stiffness: 220, damping: 26 },
  bouncy: { type: "spring", stiffness: 320, damping: 18 },
} satisfies Record<string, Transition>;

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const duration = { micro: 0.15, base: 0.3, page: 0.45, hero: 1.2 };
export const stagger = { list: 0.04, cards: 0.07, words: 0.08 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.base + 0.1, ease: ease.out } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: spring.gentle },
};

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: spring.gentle },
  exit: { opacity: 0, x: 24, transition: { duration: duration.micro } },
};

export const staggerContainer = (step = stagger.cards, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

/** Hover/tap micro-interaction used by cards and buttons. */
export const pressable = {
  whileHover: { y: -2, transition: spring.snappy },
  whileTap: { scale: 0.98, transition: spring.snappy },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.page, ease: ease.out } },
  exit: { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: duration.micro, ease: ease.inOut } },
};
