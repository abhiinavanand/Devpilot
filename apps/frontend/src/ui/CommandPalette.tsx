import { useMemo, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { commandItems } from '../data/mock';

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    return commandItems.filter((item) => item.toLowerCase().includes(lowerQuery));
  }, [query]);

  if (!open) return null;

  return (
    <div className="command-palette" onClick={onClose}>
  <div className="command-card" onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search commands or jump to a dashboard..."
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
        />
  {results.map((item: string, index: number) => (
          <div key={item} className={`command-item ${index === 0 ? 'active' : ''}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
