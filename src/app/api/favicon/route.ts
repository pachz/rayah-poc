import { NextResponse } from "next/server";
import { getSiteForRequest } from "@/app/siteConfig";

export async function GET() {
  const site = await getSiteForRequest();

  if (!site?.faviconUrl) {
    // No favicon defined for this site; return empty so the browser doesn't keep hitting defaults.
    return new Response(null, { status: 204 });
  }

  // Redirect to the per-site favicon URL (Convex storage URL).
  return NextResponse.redirect(site.faviconUrl, 302);
}

