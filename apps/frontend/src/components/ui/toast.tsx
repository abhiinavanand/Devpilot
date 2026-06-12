import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '../../lib/utils';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ({ className, ...props }: ToastPrimitive.ToastViewportProps) => (
  <ToastPrimitive.Viewport
    className={cn('fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2 outline-none', className)}
    {...props}
  />
);

export const Toast = ({ className, ...props }: ToastPrimitive.ToastProps) => (
  <ToastPrimitive.Root
    className={cn(
      'rounded-xl border border-border bg-card p-4 text-sm shadow-card data-[state=open]:animate-in data-[state=closed]:animate-out',
      className
    )}
    {...props}
  />
);

export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
