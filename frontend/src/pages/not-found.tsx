import { m } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/states";
import { DotPattern } from "@/components/magic/backgrounds";
import { Button } from "@/components/ui/button";

export default function NotFound({ standalone = false }: { standalone?: boolean }) {
  const body = (
    <div className="relative mx-auto max-w-lg py-16 text-center">
      <m.div
        initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-gradient font-mono text-8xl font-semibold tracking-tighter"
      >
        404
      </m.div>
      <EmptyState
        className="mt-6 border-none"
        title="This clause doesn’t exist"
        description="We searched every regulation and found no matching chunk ID for this page."
        action={
          <Button asChild>
            <Link to={standalone ? "/" : "/app"}>
              <ArrowLeft /> Back to {standalone ? "home" : "dashboard"}
            </Link>
          </Button>
        }
      />
    </div>
  );
  if (!standalone) return body;
  return (
    <div className="app-backdrop relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <DotPattern className="[mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
      {body}
    </div>
  );
}
