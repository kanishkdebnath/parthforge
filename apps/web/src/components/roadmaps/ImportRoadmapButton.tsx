import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onClick: () => void;
}

export function ImportRoadmapButton({ onClick }: Props) {
  return (
    <Button variant="ghost" onClick={onClick} className="gap-1.5">
      <Sparkles className="h-4 w-4" />
      Import from LLM
    </Button>
  );
}
