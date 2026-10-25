// Joins class names and skips falsy values. Enough for this app, so no clsx or tailwind-merge dependency.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
