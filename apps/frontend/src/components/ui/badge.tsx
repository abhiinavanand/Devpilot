import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground',
      className
    )}
    {...props}
  />
);
