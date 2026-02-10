import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getSiteForRequest } from "./siteConfig";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteForRequest();

  const title = site?.title ?? "Lorem Ipsum Dolor Sit Amet";
  const description =
    site?.description ??
    "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.";

  return {
    title,
    description,
    icons: site?.faviconUrl
      ? {
          icon: site.faviconUrl,
        }
      : undefined,
  };
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

  const primaryColor = site?.primaryColor ?? "#2563eb";
  const secondaryColor = site?.secondaryColor ?? "#7c3aed";

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        {
          "--primary": primaryColor,
          "--secondary": secondaryColor,
        } as CSSProperties
      }
    >
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
