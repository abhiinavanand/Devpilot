import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Root>{children}</TooltipPrimitive.Root>
);

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = ({ className, ...props }: TooltipPrimitive.TooltipContentProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={8}
      className={cn(
        'z-50 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background shadow-lg',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
);
