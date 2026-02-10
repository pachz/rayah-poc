import { headers } from "next/headers";

export type SiteConfig = {
  name: string;
  subdomain: string;
  title: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl: string | null;
};

function getWildcardDomains(): string[] {
  const raw = process.env.WILDCARD_DOMAINS;
  if (!raw) return [];

  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  console.log("[siteConfig#getWildcardDomains] Parsed wildcard domains:", domains);

  return domains;
}

function getSubdomainFromHost(hostname: string): string | null {
  const wildcardDomains = getWildcardDomains();
  if (wildcardDomains.length === 0) return null;

  const host = hostname.toLowerCase();

  console.log("[siteConfig#getSubdomainFromHost] Incoming hostname:", hostname);

  const matchedRoot = wildcardDomains.find((domain) => {
    const matches = host === domain || host.endsWith(`.${domain}`);
    if (matches) {
      console.log(
        "[siteConfig#getSubdomainFromHost] Matched root domain:",
        domain,
        "for host:",
        host
      );
    }
    return matches;
  });

  if (!matchedRoot) {
    console.log(
      "[siteConfig#getSubdomainFromHost] No wildcard domain matched for host:",
      host
    );
    return null;
  }

  if (host === matchedRoot) {
    console.log(
      "[siteConfig#getSubdomainFromHost] Host equals matched root, no subdomain:",
      host
    );
    return null;
  }

  const subdomainPart = host.slice(0, -(matchedRoot.length + 1));
  if (!subdomainPart) {
    console.log(
      "[siteConfig#getSubdomainFromHost] Empty subdomain part for host:",
      host
    );
    return null;
  }

  const [subdomain] = subdomainPart.split(".");
  if (!subdomain) {
    console.log(
      "[siteConfig#getSubdomainFromHost] Failed to extract subdomain from part:",
      subdomainPart
    );
    return null;
  }

  console.log("[siteConfig#getSubdomainFromHost] Resolved subdomain:", subdomain);

  return subdomain;
}

export async function getSiteForRequest(): Promise<SiteConfig | null> {
  const headerStore = await headers();
  const hostHeader = headerStore.get("host");

  if (!hostHeader) {
    console.log("[siteConfig#getSiteForRequest] Missing host header");
    return null;
  }

  const hostname = hostHeader.split(":")[0] ?? "";
  const subdomain = getSubdomainFromHost(hostname);

  if (!subdomain) {
    console.log(
      "[siteConfig#getSiteForRequest] No subdomain resolved for hostname:",
      hostname
    );
    return null;
  }

  const convexBaseUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexBaseUrl) {
    console.log(
      "[siteConfig#getSiteForRequest] Missing NEXT_PUBLIC_CONVEX_SITE_URL env var"
    );
    return null;
  }

  const url = `${convexBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(
    subdomain
  )}`;

  console.log("[siteConfig#getSiteForRequest] Fetching site config from:", url);

  try {
    const res = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 120, tags: ["site", `site:${subdomain}`] },
    });

    if (!res.ok) {
      console.log(
        "[siteConfig#getSiteForRequest] Convex request failed:",
        res.status,
        res.statusText
      );
      return null;
    }

    const data = (await res.json()) as SiteConfig;

    console.log("[siteConfig#getSiteForRequest] Received site config:", data);

    return data;
  } catch (error) {
    console.log(
      "[siteConfig#getSiteForRequest] Error fetching site config:",
      error
    );
    return null;
  }
}

