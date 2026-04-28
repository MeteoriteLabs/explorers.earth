import React from 'react';
import { motion } from 'framer-motion';

interface BentoCardProps {
  className?: string;
  children: React.ReactNode;
}

export default function BentoCard({ className, children }: BentoCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 16px 48px -12px rgba(0,0,0,0.6)' }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden flex flex-col rounded-2xl border border-white/[0.06] bg-[#0F1419] shadow-xl ${className || ''}`}
    >
      {children}
    </motion.div>
  );
}
