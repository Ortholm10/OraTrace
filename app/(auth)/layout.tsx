import AuthShell from "@/components/AuthShell";

// Shared by /login and /signup (the route group adds no URL segment). The background, tooth and glass box stay
// mounted across the two pages; only the form inside the box changes.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
