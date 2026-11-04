import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-lg rounded-3xl border bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
