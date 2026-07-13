import * as React from "react"

import { cn } from "@/lib/utils"

// A native <select>, styled to match <Input>. Base UI ships no select primitive
// in this registry, and every call site here has a handful of static options, so
// a real listbox would be all cost and no benefit.
//
// `text-base md:text-sm` is not a style choice: iOS Safari zooms the page in on
// focus for any form control under 16px and never zooms back out. `text-sm` is
// 14px, so a bare `text-sm` select silently traps mobile users at 1.3x zoom.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-8 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Select }
