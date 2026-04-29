import { useEffect } from "react";

type MetaInput = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const SITE_URL = "https://www.veilchat.me";
const DEFAULT_DESCRIPTION =
  "VeilChat — a private, end-to-end encrypted messenger. Free, open source, no ads, no tracking.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Lightweight per-route head manager.
 *
 * Sets <title>, <meta description>, canonical URL, robots, OpenGraph
 * and Twitter tags, and an optional JSON-LD block — and restores the
 * previous values on unmount so each route owns its own SEO surface.
 */
export function useDocumentMeta(meta: MetaInput) {
  useEffect(() => {
    const head = document.head;
    const cleanup: Array<() => void> = [];

    const previousTitle = document.title;
    if (meta.title) {
      document.title = meta.title;
      cleanup.push(() => {
        document.title = previousTitle;
      });
    }

    const upsertMeta = (
      key: "name" | "property",
      value: string,
      content: string,
    ) => {
      let el = head.querySelector<HTMLMetaElement>(
        `meta[${key}="${value}"]`,
      );
      const existed = !!el;
      const previousContent = el?.getAttribute("content") ?? null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(key, value);
        head.appendChild(el);
      }
      el.setAttribute("content", content);
      cleanup.push(() => {
        if (!existed) {
          el?.remove();
        } else if (previousContent != null) {
          el?.setAttribute("content", previousContent);
        }
      });
    };

    const upsertLink = (rel: string, href: string) => {
      let el = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      const existed = !!el;
      const previousHref = el?.getAttribute("href") ?? null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        head.appendChild(el);
      }
      el.setAttribute("href", href);
      cleanup.push(() => {
        if (!existed) {
          el?.remove();
        } else if (previousHref != null) {
          el?.setAttribute("href", previousHref);
        }
      });
    };

    if (meta.description) {
      upsertMeta("name", "description", meta.description);
      upsertMeta("property", "og:description", meta.description);
      upsertMeta("name", "twitter:description", meta.description);
    }

    if (meta.title) {
      upsertMeta("property", "og:title", meta.title);
      upsertMeta("name", "twitter:title", meta.title);
    }

    if (meta.ogImage) {
      upsertMeta("property", "og:image", meta.ogImage);
      upsertMeta("name", "twitter:image", meta.ogImage);
    }

    if (meta.ogType) {
      upsertMeta("property", "og:type", meta.ogType);
    }

    if (meta.canonical) {
      const href = meta.canonical.startsWith("http")
        ? meta.canonical
        : `${SITE_URL}${meta.canonical}`;
      upsertLink("canonical", href);
      upsertMeta("property", "og:url", href);
    }

    if (meta.noindex) {
      upsertMeta("name", "robots", "noindex, nofollow");
    } else {
      upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (meta.jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.dataset.routeJsonld = "true";
      scriptEl.textContent = JSON.stringify(meta.jsonLd);
      head.appendChild(scriptEl);
      cleanup.push(() => {
        scriptEl?.remove();
      });
    }

    return () => {
      // Run cleanups in reverse so we restore in the order we mutated.
      for (let i = cleanup.length - 1; i >= 0; i--) cleanup[i]?.();
    };
  }, [
    meta.title,
    meta.description,
    meta.canonical,
    meta.noindex,
    meta.ogImage,
    meta.ogType,
    JSON.stringify(meta.jsonLd ?? null),
  ]);
}

export const SEO_SITE_URL = SITE_URL;
export const SEO_DEFAULT_DESCRIPTION = DEFAULT_DESCRIPTION;
export const SEO_DEFAULT_OG_IMAGE = DEFAULT_OG_IMAGE;

/**
 * Convenience wrapper for private/authenticated app screens that
 * should never appear in search results. Sets a per-route title and
 * forces `robots: noindex, nofollow` so even if the URL leaks, search
 * engines drop it from the index instead of falling back to the
 * default `index, follow` from `index.html`.
 */
export function useNoindex(title: string) {
  useDocumentMeta({ title, noindex: true });
}
