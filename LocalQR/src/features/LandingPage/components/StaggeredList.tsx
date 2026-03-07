import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useStaggeredAnimation } from '../hooks/useScrollAnimation';

interface StaggeredListProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function StaggeredList({ children, className = '', staggerDelay = 100 }: StaggeredListProps) {
  const { ref, visibleItems } = useStaggeredAnimation(children.length, staggerDelay);

  return (
    <div ref={ref as any} className={className}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 30 }}
          animate={index < visibleItems ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}