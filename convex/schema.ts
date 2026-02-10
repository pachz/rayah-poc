import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  sites: defineTable({
    name: v.string(),
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    faviconStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_subdomain", ["subdomain"]),

  customDomains: defineTable({
    siteId: v.id("sites"),
    domain: v.string(), // e.g. "kooft.com" or "www.kooft.com"
    redirectFromWww: v.boolean(), // true when this domain should redirect "www." to the apex
    status: v.string(), // "pending" | "active" | "error"
    verificationType: v.optional(v.string()), // e.g. "CNAME" | "TXT"
    verificationName: v.optional(v.string()), // DNS record name/host
    verificationValue: v.optional(v.string()), // DNS record value/target
    vercelDomainId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_domain", ["domain"]),
});

export default schema;

