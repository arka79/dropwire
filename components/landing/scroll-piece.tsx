"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/**
 * Turns an object to face the reader as it arrives. The measure target is the
 * untransformed wrapper, not the moving child, so the scroll progress can never
 * feed back into its own measurement.
 */
export function ScrollPiece({
  children,
  className = "",
  rotateXFrom = 16,
  rotateYFrom = -38,
  yFrom = 18,
  perspective = 760,
}: {
  children: ReactNode;
  className?: string;
  rotateXFrom?: number;
  rotateYFrom?: number;
  yFrom?: number;
  perspective?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.94", "center 0.55"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 1], [rotateXFrom, 0]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [rotateYFrom, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [yFrom, 0]);

  return (
    <div ref={ref} className={className} style={{ perspective }}>
      <motion.div
        className="h-full w-full"
        style={
          reduced
            ? undefined
            : {
                rotateX,
                rotateY,
                y,
                transformStyle: "preserve-3d",
              }
        }
      >
        {children}
      </motion.div>
    </div>
  );
}
