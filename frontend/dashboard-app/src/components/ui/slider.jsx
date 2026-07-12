"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, color, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}>
    <SliderPrimitive.Track
      className={cn("relative h-1.5 w-full grow overflow-hidden rounded-full", !color && "bg-secondary/30")}
      style={color ? { background: `${color}2A` } : undefined}>
      <SliderPrimitive.Range className={cn("absolute h-full", !color && "bg-primary")} style={color ? { background: color } : undefined} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block h-4 w-4 rounded-full bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        !color && "border-2 border-primary",
      )}
      style={color ? { border: `2px solid ${color}` } : undefined} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
