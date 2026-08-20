export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 bg-slate-50 relative overflow-hidden">
      {/* Stadium lights effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-zff-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-zff-green/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 pitch-bg opacity-30" />
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}

