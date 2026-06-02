'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  showToggle?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showToggle = true, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(showToggle && 'pr-10', className)}
          {...props}
        />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-gray-400 hover:bg-transparent hover:text-gray-600"
            aria-label={visible ? '隐藏密码' : '显示密码'}
            tabIndex={-1}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
