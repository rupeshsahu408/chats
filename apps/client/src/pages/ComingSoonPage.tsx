import { Link } from "react-router-dom";

export function ComingSoonPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-midnight-deep via-midnight to-midnight-deep">
      <div className="w-full max-w-md text-center flex flex-col items-center gap-6">
        <div className="text-xs uppercase tracking-widest text-accent-soft">
          {phase}
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-white/60">
          This screen is part of an upcoming phase. The skeleton route exists
          so the app structure stays stable as features ship.
        </p>
        <Link
          to="/"
          className="mt-4 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-medium hover:bg-white/10 transition"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
