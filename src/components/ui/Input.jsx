import React, { forwardRef } from 'react';

const Input = forwardRef(({ className = "", ...props }, ref) => {
  const inputCls = "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-soft/60 focus:ring-2 focus:ring-magenta/50 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:placeholder:text-white/35";
  return (
    <input 
      ref={ref}
      className={`${inputCls} ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';
export default Input;
