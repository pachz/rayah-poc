import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import {
  addDomainToProject,
  deleteDomain,
  deriveDnsInstruction,
  getDomainConfig,
  normalizeDomain,
} from "./vercelDomains";

export const listForSite = query({
  args: {
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("customDomains")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .collect();
  },
});

export const getSiteByDomain = query({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = args.domain.trim().toLowerCase();

    if (!domain) {
      return null;
    }

    const record = await ctx.db
      .query("customDomains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    if (!record) {
      return null;
    }

    const site = await ctx.db.get(record.siteId);
    if (!site) {
      return null;
    }

    const faviconUrl = site.faviconStorageId
      ? await ctx.storage.getUrl(site.faviconStorageId)
      : null;

    return {
      name: site.name,
      subdomain: site.subdomain,
      title: site.title,
      description: site.description,
      primaryColor: site.primaryColor,
      secondaryColor: site.secondaryColor,
      faviconUrl,
    };
  },
});

export const insert = mutation({
  args: {
    siteId: v.id("sites"),
    domain: v.string(),
    redirectFromWww: v.boolean(),
    status: v.string(),
    vercelDomainId: v.optional(v.string()),
    verificationType: v.optional(v.string()),
    verificationName: v.optional(v.string()),
    verificationValue: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Ensure there is no duplicate for this exact domain.
    const existing = await ctx.db
      .query("customDomains")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();

    if (existing) {
      throw new Error(`Domain "${args.domain}" is already connected.`);
    }

    const id = await ctx.db.insert("customDomains", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const get = query({
  args: { id: v.id("customDomains") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("customDomains"),
    status: v.string(),
    verificationType: v.optional(v.string()),
    verificationName: v.optional(v.string()),
    verificationValue: v.optional(v.string()),
    vercelDomainId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("customDomains"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const createForSite = action({
  args: {
    siteId: v.id("sites"),
    domain: v.string(),
    redirectFromWww: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ apexId: string; wwwId: string | null }> => {
    const apexDomain = normalizeDomain(args.domain);

    // 1) Attach the primary domain to the Vercel project.
    await addDomainToProject(apexDomain);

    // 2) Fetch DNS configuration for the primary domain.
    const apexConfig = await getDomainConfig(apexDomain);
    const apexDns = deriveDnsInstruction(apexDomain, apexConfig);

    const apexId: string = await ctx.runMutation(api.customDomains.insert, {
      siteId: args.siteId,
      domain: apexDomain,
      redirectFromWww: args.redirectFromWww,
      status: apexDns.status,
      vercelDomainId: undefined,
      verificationType: apexDns.verificationType,
      verificationName: apexDns.verificationName,
      verificationValue: apexDns.verificationValue,
      error: undefined,
    });

    let wwwId: string | null = null;

    // 3) Optionally configure www.<domain> to redirect to the apex.
    if (args.redirectFromWww) {
      const wwwDomain = `www.${apexDomain}`;

      // Attach www.<domain> to the same project as a redirect.
      await addDomainToProject(wwwDomain, apexDomain);

      const wwwConfig = await getDomainConfig(wwwDomain);
      const wwwDns = deriveDnsInstruction(wwwDomain, wwwConfig);

      wwwId = await ctx.runMutation(api.customDomains.insert, {
        siteId: args.siteId,
        domain: wwwDomain,
        redirectFromWww: true,
        status: wwwDns.status,
        vercelDomainId: undefined,
        verificationType: wwwDns.verificationType,
        verificationName: wwwDns.verificationName,
        verificationValue: wwwDns.verificationValue,
        error: undefined,
      });
    }

    return {
      apexId,
      wwwId,
    };
  },
});

export const refreshStatus = action({
  args: {
    id: v.id("customDomains"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: string; status: string }> => {
    const record = await ctx.runQuery(api.customDomains.get, { id: args.id });
    if (!record) {
      throw new Error("Custom domain not found.");
    }

    let config;
    try {
      config = await getDomainConfig(record.domain);
    } catch (error: any) {
      await ctx.runMutation(api.customDomains.updateStatus, {
        id: args.id,
        status: "error",
        error:
          (error as Error)?.message ??
          "Failed to refresh status from Vercel. Please try again later.",
        vercelDomainId: record.vercelDomainId,
        verificationType: record.verificationType,
        verificationName: record.verificationName,
        verificationValue: record.verificationValue,
      });

      throw new Error(
        (error as Error)?.message ??
          "Failed to refresh status from Vercel. Please try again later."
      );
    }

    const dns = deriveDnsInstruction(record.domain, config);

    await ctx.runMutation(api.customDomains.updateStatus, {
      id: args.id,
      status: dns.status,
      error: undefined,
      vercelDomainId: record.vercelDomainId,
      verificationType: dns.verificationType,
      verificationName: dns.verificationName,
      verificationValue: dns.verificationValue,
    });

    return {
      id: args.id,
      status: dns.status,
    };
  },
});

export const removeFromProject = action({
  args: {
    id: v.id("customDomains"),
  },
  handler: async (ctx, args): Promise<void> => {
    const record = await ctx.runQuery(api.customDomains.get, { id: args.id });
    if (!record) {
      return;
    }

    try {
      await deleteDomain(record.domain);
    } catch {
      // Ignore network / API errors here.
    }

    await ctx.runMutation(api.customDomains.remove, { id: args.id });
  },
});


