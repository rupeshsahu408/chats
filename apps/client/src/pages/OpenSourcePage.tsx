import { Link } from "react-router-dom";

/**
 * Public "Open Source" landing page.
 *
 * Placeholder — content will be filled in next based on the
 * messaging the user wants to surface (repo link, license,
 * how to audit, self-host, security disclosure, etc).
 *
 * Styling matches the warm cream + forest green palette of
 * `LandingPage.tsx` so the two pages feel like one site.
 */
export function OpenSourcePage() {
  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: "#FCF5EB",
        color: "#111B21",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-24 pb-32">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[14px] text-[#3C5A47] hover:text-[#2E6F40]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M11 5l-7 7 7 7" />
          </svg>
          Back to home
        </Link>

        <h1
          className="mt-8 text-[40px] sm:text-[52px] font-semibold tracking-[-0.02em] leading-[1.05] text-[#253D2C]"
          style={{ fontFamily: "'Fraunces', 'Inter', serif", fontWeight: 600 }}
        >
          Open source.
        </h1>

        <p className="mt-5 text-[18px] text-[#3C5A47] leading-[1.6] max-w-2xl">
          Every line of VeilChat is public, licensed under AGPL-3.0. This page
          will be filled in shortly with the full story — what's in the repo,
          how to audit the encryption, how to self-host, and how to report a
          vulnerability.
        </p>

        <div className="mt-10">
          <a
            href="https://github.com/rupeshsahu408/VeilChat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#2E6F40] hover:bg-[#253D2C] text-white font-semibold text-[15px] px-6 py-3 rounded-full transition-colors"
          >
            <GithubIcon />
            View on GitHub
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.67.56.1.77-.24.77-.54 0-.27-.01-.97-.02-1.9-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.31 3.1 1.16.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.15-1.47 3.1-1.16 3.1-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.29-5.15 5.56.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.05 0 .3.2.65.78.54 4.46-1.49 7.68-5.7 7.68-10.66C23.25 5.48 18.27.5 12 .5z" />
    </svg>
  );
}
