import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const getSiteBySubdomain = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const rawSubdomain = segments[segments.length - 1] ?? "";
  const subdomain = rawSubdomain.trim().toLowerCase();

  const reserved = new Set(["admin", "www"]);
  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!subdomain || !pattern.test(subdomain) || reserved.has(subdomain)) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid subdomain. Use only letters, numbers and dashes, do not start or end with a dash, and avoid reserved names like admin or www.",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const site = await ctx.runQuery(api.sites.getBySubdomain, { subdomain });

  if (!site) {
    return new Response(
      JSON.stringify({
        error: "Site not found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const body = {
    name: site.name,
    subdomain: site.subdomain,
    title: site.title,
    description: site.description,
    primaryColor: site.primaryColor,
    secondaryColor: site.secondaryColor,
    faviconUrl: site.faviconUrl,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

const getSiteByDomain = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain") ?? "";
  const domain = rawDomain.trim().toLowerCase();

  if (!domain) {
    return new Response(
      JSON.stringify({
        error: "Domain is required",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const site = await ctx.runQuery(api.customDomains.getSiteByDomain, {
    domain,
  });

  if (!site) {
    return new Response(
      JSON.stringify({
        error: "Site not found for domain",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  return new Response(JSON.stringify(site), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

const http = httpRouter();

http.route({
  // Match all GET requests under `/` and let the handler
  // extract the subdomain from the path manually.
  pathPrefix: "/",
  method: "GET",
  handler: getSiteBySubdomain,
});

http.route({
  path: "/by-domain",
  method: "GET",
  handler: getSiteByDomain,
});

export default http;

