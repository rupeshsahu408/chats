import { Link } from "react-router-dom";
import { useDocumentMeta } from "../lib/useDocumentMeta";

/**
 * Honest 404 page. We mark it `noindex` so search engines drop the
 * URL from their results instead of treating broken links as soft
 * matches for the home page.
 */
export function NotFoundPage() {
  useDocumentMeta({
    title: "Page not found · VeilChat",
    description:
      "We couldn't find that page on VeilChat. Head back to the homepage to keep exploring.",
    noindex: true,
  });

  return (
    <div
      className="min-h-screen antialiased grid place-items-center px-6"
      style={{
        backgroundColor: "#FCF5EB",
        color: "#111B21",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="max-w-xl text-center">
        <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-[#2E6F40]">
          Error 404
        </p>
        <h1
          className="mt-3 text-[40px] sm:text-[56px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          That page is somewhere else.
        </h1>
        <p className="mt-5 text-[17px] text-[#3C5A47] leading-[1.55]">
          The link you followed might be old, mistyped, or part of the private
          app. Either way — we'll get you back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-b from-[#3A8550] to-[#2E6F40] hover:from-[#2E6F40] hover:to-[#253D2C] text-white font-semibold text-[15px] px-6 py-3 rounded-full shadow-[0_18px_36px_-14px_rgba(46,111,64,0.55)]"
          >
            Back to home
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center justify-center gap-2 bg-white border border-[#253D2C]/12 text-[#253D2C] hover:text-[#2E6F40] hover:border-[#2E6F40]/35 font-semibold text-[15px] px-6 py-3 rounded-full"
          >
            About VeilChat
          </Link>
        </div>
      </div>
    </div>
  );
}
