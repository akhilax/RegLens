// Rebuilt from 21st.dev "File Upload" by manuarora700 (https://21st.dev/@manuarora700/components/file-upload)
import { AnimatePresence, m } from "motion/react";
import { FileText, UploadCloud } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  accept: string;
  onFile: (file: File) => void;
  title: string;
  hint: string;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({ accept, onFile, title, hint, disabled, className }: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const pick = (f: File | undefined) => {
    if (!f || disabled) return;
    setFile(f);
    onFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    pick(e.dataTransfer.files?.[0]);
  };

  return (
    <m.label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      whileHover={disabled ? undefined : "hover"}
      animate={drag ? "hover" : "rest"}
      initial="rest"
      className={cn(
        "group relative block cursor-pointer overflow-hidden rounded-2xl border border-dashed p-8 text-center transition-colors",
        drag ? "border-brand bg-accent/40" : "border-border-strong hover:border-brand/60",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="relative flex flex-col items-center gap-3">
        <div className="relative">
          <m.div
            variants={{ rest: { y: 0, scale: 1 }, hover: { y: -6, scale: 1.06 } }}
            transition={spring.bouncy}
            className="relative z-10 grid size-14 place-items-center rounded-xl border border-border-strong bg-card shadow-soft"
          >
            <UploadCloud className="size-6 text-brand" />
          </m.div>
          <m.div
            aria-hidden
            variants={{ rest: { opacity: 0, scale: 0.9 }, hover: { opacity: 1, scale: 1.15 } }}
            transition={spring.gentle}
            className="absolute inset-0 rounded-xl border border-dashed border-brand"
          />
        </div>
        <div>
          <p className="text-sm font-medium">{drag ? "Drop to upload" : title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <AnimatePresence>
          {file && (
            <m.div
              key={file.name + file.size}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
            >
              <FileText className="size-3.5 text-brand" />
              <span className="max-w-48 truncate font-mono">{file.name}</span>
              <span className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.label>
  );
}
