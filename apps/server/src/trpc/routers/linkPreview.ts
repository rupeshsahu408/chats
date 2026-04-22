import { TRPCError } from "@trpc/server";
import { LinkPreviewInput, LinkPreviewSchema, type LinkPreview } from "@veil/shared";
import { protectedProcedure, router } from "../init.js";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_BYTES = 256 * 1024; // 256 KB of HTML is plenty to find <head>
const UA = "Mozilla/5.0 (compatible; VeilLinkPreview/1.0; +https://veil.chat)";

const cache = new Map<string, { at: number; data: LinkPreview }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function isPrivateHost(host: string): boolean {
  // Reject obvious local / RFC1918 / loopback / link-local before we
  // even DNS-resolve. Defence-in-depth against SSRF abuse.
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^fc[0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;
  return false;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function metaContent(html: string, name: string): string | null {
  // Look for <meta property="X" content="Y"> or name="X". Tolerant of attr order.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;
  const cm = /content=["']([^"']+)["']/i.exec(m[0]);
  return cm && cm[1] ? decodeEntities(cm[1]).trim() : null;
}

function titleTag(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m && m[1] ? decodeEntities(m[1].trim()) : null;
}

function abs(base: string, maybe: string | null): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

async function fetchPreview(rawUrl: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid URL." });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only http/https." });
  }
  if (isPrivateHost(url.hostname)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Host not allowed." });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Could not fetch URL." });
  } finally {
    clearTimeout(t);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("xml")) {
    return {
      url: rawUrl,
      resolvedUrl: res.url,
      title: null,
      description: null,
      siteName: null,
      imageUrl: null,
    };
  }

  // Read at most MAX_BYTES of the body.
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (total < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(
    chunks.length === 1 ? chunks[0] : concat(chunks),
  );

  const title =
    metaContent(html, "og:title") ??
    metaContent(html, "twitter:title") ??
    titleTag(html);
  const description =
    metaContent(html, "og:description") ??
    metaContent(html, "twitter:description") ??
    metaContent(html, "description");
  const siteName = metaContent(html, "og:site_name");
  const imageUrl = abs(
    res.url,
    metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
  );

  return {
    url: rawUrl,
    resolvedUrl: res.url,
    title: title ? title.slice(0, 300) : null,
    description: description ? description.slice(0, 500) : null,
    siteName: siteName ? siteName.slice(0, 120) : null,
    imageUrl,
  };
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.byteLength;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}

export const linkPreviewRouter = router({
  /**
   * Server-proxied OG fetch. The recipient never hits the third-party
   * site directly, so a malicious link can't exfiltrate their IP.
   */
  fetch: protectedProcedure
    .input(LinkPreviewInput)
    .output(LinkPreviewSchema)
    .mutation(async ({ input }) => {
      const cached = cache.get(input.url);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
      }
      const preview = await fetchPreview(input.url);
      cache.set(input.url, { at: Date.now(), data: preview });
      // Cap cache size to ~500 entries.
      if (cache.size > 500) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      return preview;
    }),
});
