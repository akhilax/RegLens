// domMax (layout + drag + animations) is loaded in its own chunk after first paint,
// keeping Motion's footprint in the initial bundle to the tiny `m` component core.
import { domMax } from "motion/react";

export default domMax;
