// Full-bleed passthrough — auth pages own their own (split-screen) layout.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">{children}</div>;
}
