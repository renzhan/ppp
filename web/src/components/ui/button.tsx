import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-white rounded-md hover:bg-brand-600',
        secondary:
          'bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50',
        'text-link':
          'text-brand hover:underline bg-transparent border-none p-0 h-auto',
        success:
          'bg-success text-white rounded-md hover:opacity-90',
        submit:
          'bg-brand text-white rounded-md hover:bg-brand-600',
        destructive:
          'bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90',
        ghost:
          'hover:bg-gray-50 hover:text-gray-900 rounded-md',
        outline:
          'border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50',
      },
      size: {
        default: 'h-10 px-6',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-8',
        submit: 'h-[44px] px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // Auto-apply submit size when variant is submit and no explicit size
    const resolvedSize = variant === 'submit' && !size ? 'submit' : size;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size: resolvedSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
