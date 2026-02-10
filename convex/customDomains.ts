import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import {
  addDomain,
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

    const apexResult = await addDomain(apexDomain);
    const apexConfig = await getDomainConfig(apexDomain);
    const apexDns = deriveDnsInstruction(apexDomain, apexConfig);

    const apexId: string = await ctx.runMutation(api.customDomains.insert, {
      siteId: args.siteId,
      domain: apexDomain,
      redirectFromWww: args.redirectFromWww,
      status: apexDns.status,
      vercelDomainId: apexResult.id,
      verificationType: apexDns.verificationType,
      verificationName: apexDns.verificationName,
      verificationValue: apexDns.verificationValue,
      error: undefined,
    });

    let wwwId: string | null = null;

    // 2) Optionally configure www.<domain> to redirect to the apex.
    if (args.redirectFromWww) {
      const wwwDomain = `www.${apexDomain}`;

      let wwwResultOk = true;
      try {
        await addDomain(wwwDomain);
      } catch (error: any) {
        wwwResultOk = false;
      }

      if (!wwwResultOk) {
        // Do not rollback apex; just record an error for the www domain.
        const message = `Failed to configure www redirect for "${apexDomain}".`;

        // DNS info may still be available.
        let wwwDns: ReturnType<typeof deriveDnsInstruction> | undefined;
        try {
          const wwwConfig = await getDomainConfig(wwwDomain);
          wwwDns = deriveDnsInstruction(wwwDomain, wwwConfig);
        } catch {
          // ignore
        }

        wwwId = await ctx.runMutation(api.customDomains.insert, {
          siteId: args.siteId,
          domain: wwwDomain,
          redirectFromWww: true,
          status: "error",
          vercelDomainId: undefined,
          verificationType: wwwDns?.verificationType,
          verificationName: wwwDns?.verificationName,
          verificationValue: wwwDns?.verificationValue,
          error: message,
        });
      } else {
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


