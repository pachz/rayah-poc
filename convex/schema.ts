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
});

export default schema;

