import { headers } from "next/headers";

type SiteConfig = {
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

  console.log("[page#getWildcardDomains] Parsed wildcard domains:", domains);

  return domains;
}

function getSubdomainFromHost(hostname: string): string | null {
  const wildcardDomains = getWildcardDomains();
  if (wildcardDomains.length === 0) return null;

  const host = hostname.toLowerCase();

  console.log("[page#getSubdomainFromHost] Incoming hostname:", hostname);

  const matchedRoot = wildcardDomains.find((domain) => {
    const matches = host === domain || host.endsWith(`.${domain}`);
    if (matches) {
      console.log(
        "[page#getSubdomainFromHost] Matched root domain:",
        domain,
        "for host:",
        host
      );
    }
    return matches;
  });

  if (!matchedRoot) {
    console.log(
      "[page#getSubdomainFromHost] No wildcard domain matched for host:",
      host
    );
    return null;
  }

  if (host === matchedRoot) {
    console.log(
      "[page#getSubdomainFromHost] Host equals matched root, no subdomain:",
      host
    );
    return null;
  }

  const subdomainPart = host.slice(0, -(matchedRoot.length + 1));
  if (!subdomainPart) {
    console.log(
      "[page#getSubdomainFromHost] Empty subdomain part for host:",
      host
    );
    return null;
  }

  const [subdomain] = subdomainPart.split(".");
  if (!subdomain) {
    console.log(
      "[page#getSubdomainFromHost] Failed to extract subdomain from part:",
      subdomainPart
    );
    return null;
  }

  console.log("[page#getSubdomainFromHost] Resolved subdomain:", subdomain);

  return subdomain;
}

async function getSiteForRequest(): Promise<SiteConfig | null> {
  const headerStore = await headers();
  const hostHeader = headerStore.get("host");

  if (!hostHeader) {
    console.log("[page#getSiteForRequest] Missing host header");
    return null;
  }

  const hostname = hostHeader.split(":")[0] ?? "";
  const subdomain = getSubdomainFromHost(hostname);

  if (!subdomain) {
    console.log(
      "[page#getSiteForRequest] No subdomain resolved for hostname:",
      hostname
    );
    return null;
  }

  const convexBaseUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexBaseUrl) {
    console.log(
      "[page#getSiteForRequest] Missing NEXT_PUBLIC_CONVEX_SITE_URL env var"
    );
    return null;
  }

  const url = `${convexBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(
    subdomain
  )}`;

  console.log("[page#getSiteForRequest] Fetching site config from:", url);

  try {
    const res = await fetch(url, {
      // Cache Convex responses per subdomain with ISR-style revalidation.
      cache: "force-cache",
      next: { revalidate: 60, tags: ["site", `site:${subdomain}`] },
    });

    if (!res.ok) {
      console.log(
        "[page#getSiteForRequest] Convex request failed:",
        res.status,
        res.statusText
      );
      return null;
    }

    const data = (await res.json()) as SiteConfig;

    console.log("[page#getSiteForRequest] Received site config:", data);

    return data;
  } catch (error) {
    console.log("[page#getSiteForRequest] Error fetching site config:", error);
    return null;
  }
}

export default async function Home() {
  const site = await getSiteForRequest();

  if (!site) {
    console.log(
      "[page#Home] No site config resolved, falling back to default content"
    );
  } else {
    console.log("[page#Home] Rendering site with config:", site);
  }

  const title = site?.title ?? "Lorem Ipsum Dolor Sit Amet";
  const description =
    site?.description ??
    "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mb-12 text-lg text-foreground/80">{description}</p>

        <div className="space-y-8">
          <section className="rounded-lg border border-primary/20 bg-primary/5 p-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-primary">
              Primary Color
            </h2>
            <p className="text-foreground/90">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
            <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              Primary Button
            </button>
          </section>

          <section className="rounded-lg border border-secondary/20 bg-secondary/5 p-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-secondary">
              Secondary Color
            </h2>
            <p className="text-foreground/90">
              Duis aute irure dolor in reprehenderit in voluptate velit esse
              cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
              cupidatat non proident, sunt in culpa qui officia deserunt mollit.
            </p>
            <button className="mt-4 rounded-md border-2 border-secondary px-4 py-2 text-sm font-medium text-secondary transition-opacity hover:opacity-90">
              Secondary Button
            </button>
          </section>

          <section className="rounded-lg border border-foreground/10 p-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-foreground/70">
              Lorem Content
            </h2>
            <p className="text-foreground/80">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
