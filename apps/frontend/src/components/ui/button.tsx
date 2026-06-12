import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        ghost: 'bg-transparent text-foreground hover:bg-muted',
        subtle: 'bg-muted text-foreground',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = ({ className, variant, ...props }: ButtonProps) => (
  <button className={cn(buttonVariants({ variant }), className)} {...props} />
);
