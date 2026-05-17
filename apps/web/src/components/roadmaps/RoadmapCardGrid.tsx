import { motion } from 'motion/react';
import type { Roadmap } from '@pathforge/shared';
import { RoadmapCard } from './RoadmapCard';

interface Props {
  roadmaps: Roadmap[];
}

export function RoadmapCardGrid({ roadmaps }: Props) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {roadmaps.map((r, idx) => (
        <motion.div
          key={r._id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <RoadmapCard roadmap={r} index={idx} />
        </motion.div>
      ))}
    </div>
  );
}
