import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("inline-flex rounded-control border border-input bg-card p-0.5", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium text-muted-foreground transition-colors",
        "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
