"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cn, IconButton } from "./ui";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const stack: object[] = [];
let lockCount = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount++ === 0) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${gap}px`;
    }
    return () => {
      if (--lockCount === 0) {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }
    };
  }, [active]);
}

const SPRING = { type: "spring", stiffness: 420, damping: 40, mass: 0.9 } as const;

/**
 * Responsive overlay: a bottom sheet on phones, a centred dialog (`variant="dialog"`)
 * or a right-side drawer (`variant="drawer"`) on larger screens.
 */
export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  variant = "dialog",
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  variant?: "dialog" | "drawer";
  width?: string;
}) {
  const isDesktop = useMediaQuery(variant === "drawer" ? "(min-width: 768px)" : "(min-width: 640px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  useScrollLock(open);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = {};
    stack.push(token);
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most overlay reacts, so Escape peels one layer at a time.
      if (e.key === "Escape" && stack[stack.length - 1] === token) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    // Skip autofocus on touch screens: popping the keyboard over a sheet is jarring.
    const t = window.matchMedia("(pointer: fine)").matches
      ? setTimeout(() => {
          const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input, button:not([data-close])");
          el?.focus({ preventScroll: true });
        }, 60)
      : undefined;
    return () => {
      stack.splice(stack.indexOf(token), 1);
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const sheet = !isDesktop;
  const drawer = isDesktop && variant === "drawer";

  const motionProps = sheet
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : drawer
      ? { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } }
      : {
          initial: { opacity: 0, scale: 0.96, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15 } },
        };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-[#0b1020]/40 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex",
              sheet && "items-end",
              drawer && "justify-end",
              !sheet && !drawer && "items-center justify-center p-6",
            )}
          >
            <motion.div
              ref={panelRef}
              {...motionProps}
              transition={SPRING}
              drag={sheet ? "y" : false}
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
              className={cn(
                "pointer-events-auto flex flex-col bg-surface shadow-pop",
                sheet && "max-h-[92dvh] w-full rounded-t-[28px] pb-[env(safe-area-inset-bottom)]",
                drawer && "h-full w-full max-w-xl border-l border-line",
                !sheet && !drawer && cn("max-h-[calc(100dvh-48px)] w-full rounded-3xl", width),
              )}
            >
              {sheet && (
                <div
                  className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing"
                  onPointerDown={(e) => drag.start(e)}
                >
                  <span className="h-1.5 w-10 rounded-full bg-line-strong" />
                </div>
              )}
              <div
                className={cn("flex shrink-0 items-start justify-between gap-4 px-5 sm:px-6", sheet ? "pt-2 pb-3" : "pt-5 pb-4")}
                onPointerDown={sheet ? (e) => drag.start(e) : undefined}
              >
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
                  {description && <div className="mt-0.5 text-sm text-ink-2">{description}</div>}
                </div>
                <IconButton label="Close" data-close onClick={onClose} className="-mr-2 -mt-1">
                  <X className="size-5" />
                </IconButton>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function OverlayBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6", className)}>{children}</div>
  );
}

export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
      {children}
    </div>
  );
}
