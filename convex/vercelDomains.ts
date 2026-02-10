import { v } from "convex/values";

export type VercelDomainResponse = {
  id?: string;
  name: string;
  verified?: boolean;
};

export type VercelDomainConfigResponse = {
  configuredBy: "CNAME" | "A" | "http" | "dns-01" | null;
  acceptedChallenges: string[];
  recommendedIPv4: { rank: number; value: string[] }[];
  recommendedCNAME: { rank: number; value: string }[];
  misconfigured: boolean;
};

export type DnsInstruction = {
  status: "active" | "pending";
  verificationType?: string;
  verificationName?: string;
  verificationValue?: string;
};

const token = process.env.VERCEL_ACCESS_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const teamSlug = process.env.VERCEL_TEAM_SLUG;
const projectId = process.env.VERCEL_PROJECT_ID;

async function callVercel<T>(
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; data: T; errorMessage?: string }> {
  if (!token) {
    throw new Error(
      "Missing Vercel configuration. Please set VERCEL_ACCESS_TOKEN in Convex environment variables."
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`https://api.vercel.com${normalizedPath}`);

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  } else if (teamSlug) {
    url.searchParams.set("slug", teamSlug);
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const data = (await res.json()) as any;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data,
      errorMessage: data?.error?.message ?? data?.message ?? "Vercel API error",
    };
  }

  return { ok: true, status: res.status, data };
}

export function normalizeDomain(raw: string): string {
  let domain = raw.trim().toLowerCase();

  if (!domain) {
    throw new Error("Domain is required.");
  }

  domain = domain.replace(/^https?:\/\//, "");

  const firstSlash = domain.indexOf("/");
  if (firstSlash !== -1) {
    domain = domain.slice(0, firstSlash);
  }

  if (!domain.includes(".")) {
    throw new Error(
      'Please enter a valid domain name like "kooft.com" (no protocol, no path).'
    );
  }

  if (domain.endsWith(".")) {
    domain = domain.slice(0, -1);
  }

  return domain;
}

export async function addDomainToProject(name: string, redirect?: string) {
  if (!projectId) {
    throw new Error(
      "Missing Vercel configuration. Please set VERCEL_PROJECT_ID in Convex environment variables."
    );
  }

  const result = await callVercel<unknown>(
    `/v10/projects/${encodeURIComponent(projectId)}/domains`,
    {
      method: "POST",
      body: JSON.stringify(
        redirect
          ? {
              name,
              redirect,
            }
          : {
              name,
            }
      ),
    }
  );

  if (!result.ok) {
    throw new Error(
      `Failed to attach domain "${name}" to Vercel project: ${result.errorMessage}`
    );
  }
}

export async function getDomainConfig(
  name: string
): Promise<VercelDomainConfigResponse> {
  const result = await callVercel<VercelDomainConfigResponse>(
    `/v6/domains/${encodeURIComponent(name)}/config`,
    { method: "GET" }
  );

  if (!result.ok) {
    throw new Error(
      `Failed to load DNS configuration for "${name}" from Vercel: ${result.errorMessage}`
    );
  }

  return result.data;
}

export function deriveDnsInstruction(
  domain: string,
  config: VercelDomainConfigResponse
): DnsInstruction {
  const recommendedCname = config.recommendedCNAME?.[0];
  const recommendedIpv4 = config.recommendedIPv4?.[0];

  let verificationType: string | undefined;
  let verificationName: string | undefined;
  let verificationValue: string | undefined;

  // Heuristic: apex domains (two labels, e.g. "borj.info") should use A,
  // since many DNS providers don't allow CNAME at the zone apex. Subdomains
  // (three or more labels) can prefer CNAME.
  const labels = domain.split(".").filter(Boolean);
  const isApex = labels.length === 2;

  if (isApex && recommendedIpv4 && recommendedIpv4.value?.length) {
    verificationType = "A";
    verificationName = domain;
    verificationValue = recommendedIpv4.value[0];
  } else if (!isApex && recommendedCname) {
    verificationType = "CNAME";
    verificationName = domain;
    verificationValue = recommendedCname.value;
  } else if (recommendedIpv4 && recommendedIpv4.value?.length) {
    // Fallback to A if we couldn't use CNAME.
    verificationType = "A";
    verificationName = domain;
    verificationValue = recommendedIpv4.value[0];
  } else if (recommendedCname) {
    verificationType = "CNAME";
    verificationName = domain;
    verificationValue = recommendedCname.value;
  }

  const status: "active" | "pending" = config.misconfigured
    ? "pending"
    : "active";

  return {
    status,
    verificationType,
    verificationName,
    verificationValue,
  };
}

export async function deleteDomain(name: string): Promise<void> {
  // Best-effort; ignore failures so callers can still clean up local state.
  try {
    await callVercel<unknown>(`/v6/domains/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore
  }
}

// Exporting this so Convex can validate env var presence at deploy time if desired.
export const vercelEnvSchema = {
  VERCEL_ACCESS_TOKEN: v.string(),
};

