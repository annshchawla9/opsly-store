import * as React from "react";
import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent" | "success" | "warning" | "muted";
  hover?: boolean;
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, variant = "default", hover = false, ...props }, ref) => {
    const variantStyles = {
      default: "bg-card border-border",
      accent: "bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20",
      success: "bg-gradient-to-br from-success/5 to-success/10 border-success/20",
      warning: "bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20",
      muted: "bg-muted/50 border-muted",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border p-4 shadow-card transition-all duration-200",
          variantStyles[variant],
          hover && "card-hover cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
);
PremiumCard.displayName = "PremiumCard";

const PremiumCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between mb-3", className)}
    {...props}
  />
));
PremiumCardHeader.displayName = "PremiumCardHeader";

const PremiumCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-sm font-semibold text-foreground", className)}
    {...props}
  />
));
PremiumCardTitle.displayName = "PremiumCardTitle";

const PremiumCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
PremiumCardContent.displayName = "PremiumCardContent";

export { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent };
