import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizeAndValidateSubdomain(raw: string): string {
  const subdomain = raw.trim().toLowerCase();

  if (!subdomain) {
    throw new Error("Subdomain is required.");
  }

  if (subdomain.length < 3 || subdomain.length > 63) {
    throw new Error("Subdomain must be between 3 and 63 characters.");
  }

  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!pattern.test(subdomain)) {
    throw new Error(
      "Subdomain can only contain letters, numbers and dashes, and cannot start or end with a dash."
    );
  }

  return subdomain;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").order("desc").collect();

    return Promise.all(
      sites.map(async (site) => {
        const faviconUrl = site.faviconStorageId
          ? await ctx.storage.getUrl(site.faviconStorageId)
          : null;

        return {
          ...site,
          faviconUrl,
        };
      })
    );
  },
});

export const getBySubdomain = query({
  args: {
    subdomain: v.string(),
  },
  handler: async (ctx, args) => {
    const subdomain = normalizeAndValidateSubdomain(args.subdomain);

    const site = await ctx.db
      .query("sites")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();

    if (!site) {
      return null;
    }

    return {
      ...site,
      faviconUrl: site.faviconStorageId
        ? await ctx.storage.getUrl(site.faviconStorageId)
        : null,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    faviconStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const subdomain = normalizeAndValidateSubdomain(args.subdomain);

    const existing = await ctx.db
      .query("sites")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();

    if (existing) {
      throw new Error("Subdomain is already in use.");
    }

    const now = Date.now();

    const id = await ctx.db.insert("sites", {
      ...args,
      subdomain,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("sites"),
    name: v.string(),
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    faviconStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    const subdomain = normalizeAndValidateSubdomain(rest.subdomain);

    const existing = await ctx.db
      .query("sites")
      .withIndex("by_subdomain", (q) => q.eq("subdomain", subdomain))
      .first();

    if (existing && existing._id !== id) {
      throw new Error("Subdomain is already in use.");
    }

    await ctx.db.patch(id, {
      ...rest,
      subdomain,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("sites"),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.id);
    if (site?.faviconStorageId) {
      await ctx.storage.delete(site.faviconStorageId);
    }

    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

