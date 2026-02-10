"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Site = NonNullable<ReturnType<typeof useQuery<typeof api.sites.list>>>[number];

type SiteFormState = {
  id?: string;
  name: string;
  subdomain: string;
  title: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  faviconStorageId?: string;
  faviconUrl?: string | null;
};

type CustomDomain = NonNullable<
  ReturnType<typeof useQuery<typeof api.customDomains.listForSite>>
>[number];

const EMPTY_FORM: SiteFormState = {
  name: "",
  subdomain: "",
  title: "",
  description: "",
  primaryColor: "#0f172a",
  secondaryColor: "#38bdf8",
};

export default function SiteManagerPage() {
  const sites = useQuery(api.sites.list) ?? [];

  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(
    undefined
  );

  const customDomains: CustomDomain[] =
    useQuery(
      api.customDomains.listForSite,
      selectedSiteId
        ? ({
            siteId: selectedSiteId as any,
          } as any)
        : "skip"
    ) ?? [];

  const createSite = useMutation(api.sites.create);
  const updateSite = useMutation(api.sites.update);
  const deleteSite = useMutation(api.sites.remove);
  const generateUploadUrl = useMutation(api.sites.generateUploadUrl);

  const createCustomDomain = useAction(api.customDomains.createForSite);
  const refreshCustomDomain = useAction(api.customDomains.refreshStatus);
  const deleteCustomDomain = useAction(api.customDomains.removeFromProject);

  const [form, setForm] = useState<SiteFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const isEditMode = useMemo(() => Boolean(form.id), [form.id]);

  useEffect(() => {
    setError(null);
  }, [form]);

  const handleSelectSite = (site: Site) => {
    setForm({
      id: site._id,
      name: site.name,
      subdomain: site.subdomain,
      title: site.title,
      description: site.description,
      primaryColor: site.primaryColor,
      secondaryColor: site.secondaryColor,
      faviconStorageId: site.faviconStorageId,
      faviconUrl: site.faviconUrl,
    });
    setSelectedSiteId(site._id as any);
    setIsFormOpen(true);
  };

  const handleNewSite = () => {
    setForm(EMPTY_FORM);
    setSelectedSiteId(undefined);
    setIsFormOpen(true);
  };

  const handleChange = (field: keyof SiteFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      subdomain: form.subdomain.trim().toLowerCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      faviconStorageId: form.faviconStorageId as any,
    };

    try {
      if (!payload.name || !payload.subdomain || !payload.title) {
        throw new Error("Name, subdomain and title are required.");
      }

      if (isEditMode && form.id) {
        await updateSite({
          id: form.id as any,
          ...payload,
        });
      } else {
        const id = await createSite(payload);
        setSelectedSiteId(id as any);
      }

      setForm(EMPTY_FORM);
      setIsFormOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong while saving the site.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this site?")) return;

    try {
      await deleteSite({ id: id as any });
      if (form.id === id) {
        setForm(EMPTY_FORM);
        setSelectedSiteId(undefined);
        setIsFormOpen(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete site.");
    }
  };

  const handleAddCustomDomain = async () => {
    if (!form.id) {
      setError("Please save the site before adding a custom domain.");
      return;
    }

    const rawDomain = window.prompt(
      'Enter the custom domain (e.g. "kooft.com", without protocol):'
    );
    if (!rawDomain) return;

    const normalizedInput = rawDomain.trim().toLowerCase();

    // Basic normalization similar to what happens on the backend.
    let hostname = normalizedInput.replace(/^https?:\/\//, "");
    const slashIndex = hostname.indexOf("/");
    if (slashIndex !== -1) {
      hostname = hostname.slice(0, slashIndex);
    }
    if (hostname.endsWith(".")) {
      hostname = hostname.slice(0, -1);
    }

    const labels = hostname.split(".").filter(Boolean);
    const isApexDomain = labels.length === 2 && !hostname.startsWith("www.");

    let alsoRedirectWww = false;
    if (isApexDomain) {
      alsoRedirectWww = window.confirm(
        `Also configure "www.${hostname}" to redirect to "${hostname}"?`
      );
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createCustomDomain({
        siteId: form.id as any,
        domain: rawDomain,
        redirectFromWww: alsoRedirectWww,
      });
    } catch (e: any) {
      setError(
        e?.message ??
          "Something went wrong while creating the custom domain in Vercel."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshDomainStatus = async (domainId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await refreshCustomDomain({ id: domainId as any });
    } catch (e: any) {
      setError(
        e?.message ??
          "Something went wrong while refreshing the custom domain status."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    if (
      !window.confirm(
        `Remove custom domain "${domainName}"? This will also attempt to detach it from the Vercel project.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await deleteCustomDomain({ id: domainId as any });
    } catch (e: any) {
      setError(
        e?.message ??
          "Something went wrong while removing the custom domain from Vercel."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFaviconChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Failed to upload favicon.");
      }

      const { storageId } = (await result.json()) as { storageId: string };

      const previewUrl = URL.createObjectURL(file);

      setForm((prev) => ({
        ...prev,
        faviconStorageId: storageId,
        faviconUrl: previewUrl,
      }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload favicon.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Control Center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Site Manager
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Manage your sites, subdomains, branding and favicons from a single
              clean dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 shadow-lg shadow-slate-950/40 backdrop-blur">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              SM
            </div>
            <div>
              <p className="font-medium text-slate-100">Sites overview</p>
              <p className="text-[11px] text-slate-400">
                {sites.length} site{sites.length === 1 ? "" : "s"} connected
              </p>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)]">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-2xl shadow-black/60 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium text-slate-100">
                  Sites list
                </h2>
                <p className="text-xs text-slate-400">
                  Select a site to edit or remove it.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewSite}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100 hover:border-slate-500 hover:text-white"
              >
                + New site
              </button>
            </div>

            <div className="mt-1 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Site</th>
                    <th className="px-4 py-3 text-left">Subdomain</th>
                    <th className="px-4 py-3 text-left">Colors</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sites.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-xs text-slate-400"
                      >
                        No sites yet. Create your first site using the panel on
                        the right.
                      </td>
                    </tr>
                  ) : (
                    sites.map((site) => (
                      <tr
                        key={site._id}
                        className="group cursor-pointer bg-slate-950/40 hover:bg-slate-900/80"
                        onClick={() => handleSelectSite(site)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-[10px] uppercase text-slate-400">
                              {site.faviconUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={site.faviconUrl}
                                  alt={site.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                site.name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {site.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {site.title}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          {site.subdomain}.borj.pro
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border border-slate-700"
                              style={{
                                backgroundColor: site.primaryColor,
                              }}
                            />
                            <span
                              className="h-4 w-4 rounded-full border border-slate-700"
                              style={{
                                backgroundColor: site.secondaryColor,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <div className="flex justify-end gap-2 opacity-90 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSelectSite(site);
                              }}
                              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-sky-500 hover:text-sky-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(site._id as any);
                              }}
                              className="rounded-full border border-transparent bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {isFormOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-10">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-800/80 bg-slate-950/90 p-5 shadow-2xl shadow-black/80 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium text-slate-100">
                    {isEditMode ? "Edit site" : "Create site"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Define branding, domain and metadata for this site.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditMode && (
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-sky-300">
                      Editing
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-100"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-100">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="mt-4 flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    label="Site name"
                    required
                    description="Internal name to identify this site."
                  >
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        handleChange("name", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 ring-sky-500/0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/70"
                      placeholder="Marketing website"
                    />
                  </FormField>

                  <FormField
                    label="Subdomain"
                    required
                    description="Only letters, numbers, dashes."
                  >
                    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/70">
                      <input
                        type="text"
                        value={form.subdomain}
                        onChange={(event) =>
                          handleChange("subdomain", event.target.value)
                        }
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                        placeholder="my-site"
                      />
                      <span className="truncate text-xs text-slate-500">
                        .borj.pro
                      </span>
                    </div>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <FormField
                    label="Title"
                    required
                    description="Used for the site head title and SEO."
                  >
                    <input
                      type="text"
                      value={form.title}
                      onChange={(event) =>
                        handleChange("title", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 ring-sky-500/0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/70"
                      placeholder="The modern way to manage content"
                    />
                  </FormField>

                  <FormField
                    label="Description"
                    description="Short description that appears in previews and search results."
                  >
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        handleChange("description", event.target.value)
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 ring-sky-500/0 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/70"
                      placeholder="High-converting landing pages for modern teams."
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <h3 className="text-xs font-medium text-slate-200">
                      Brand colors
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Primary color drives accents, secondary is for subtle
                      highlights.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <ColorField
                        label="Primary"
                        value={form.primaryColor}
                        onChange={(value) =>
                          handleChange("primaryColor", value)
                        }
                      />
                      <ColorField
                        label="Secondary"
                        value={form.secondaryColor}
                        onChange={(value) =>
                          handleChange("secondaryColor", value)
                        }
                      />
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Preview</span>
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          Brand card
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium text-slate-100">
                            {form.name || "Site name"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {form.title || "Site headline goes here"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-7 w-7 rounded-full border border-slate-900 shadow-sm shadow-black/40"
                            style={{ backgroundColor: form.primaryColor }}
                          />
                          <span
                            className="h-7 w-7 rounded-full border border-slate-900 shadow-sm shadow-black/40"
                            style={{ backgroundColor: form.secondaryColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <h3 className="text-xs font-medium text-slate-200">
                      Favicon
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Upload a square image (at least 64×64px) for best results.
                    </p>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-950 text-[10px] uppercase text-slate-500">
                        {form.faviconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={form.faviconUrl}
                            alt="Favicon"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          "Icon"
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 text-[11px] text-slate-300">
                        <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-sky-500 hover:text-sky-200">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFaviconChange}
                          />
                          Upload image
                        </label>
                        <span className="text-[10px] text-slate-500">
                          PNG, JPG, or ICO. Max 1MB.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-medium text-slate-200">
                        Custom domains
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Connect custom domains like{" "}
                        <span className="font-mono text-slate-200">
                          kooft.com
                        </span>{" "}
                        and manage DNS, redirects and status.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting || !form.id}
                      onClick={handleAddCustomDomain}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-sky-500 hover:text-sky-200 disabled:opacity-50"
                    >
                      + Add domain
                    </button>
                  </div>

                  {!form.id ? (
                    <p className="text-[11px] text-slate-500">
                      Save the site first, then you can connect a custom domain.
                    </p>
                  ) : customDomains.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No custom domains connected yet.
                    </p>
                  ) : (
                    <div className="mt-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                      <table className="min-w-full divide-y divide-slate-800 text-[11px]">
                        <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-3 py-2 text-left">Domain</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">
                              DNS instructions
                            </th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {customDomains.map((domain) => (
                            <tr key={domain._id} className="bg-slate-950/60">
                              <td className="px-3 py-2 align-top font-mono text-slate-100">
                                {domain.domain}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                                    domain.status === "active"
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : domain.status === "error"
                                      ? "bg-red-500/10 text-red-300"
                                      : "bg-amber-500/10 text-amber-200"
                                  }`}
                                >
                                  {domain.status}
                                </span>
                                {domain.redirectFromWww && (
                                  <div className="mt-1 text-[9px] text-slate-400">
                                    Redirects{" "}
                                    <span className="font-mono text-slate-200">
                                      www
                                    </span>{" "}
                                    to apex.
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {domain.verificationType &&
                                domain.verificationName &&
                                domain.verificationValue ? (
                                  <div className="rounded-md bg-slate-950/80 p-1.5 text-[10px] text-slate-300">
                                    <p className="mb-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                                      DNS record to configure
                                    </p>
                                    <p>
                                      <span className="font-mono text-slate-200">
                                        {domain.verificationType}
                                      </span>{" "}
                                      <span className="font-mono text-slate-200">
                                        {domain.verificationName}
                                      </span>{" "}
                                      <span className="font-mono text-slate-200">
                                        {domain.verificationValue}
                                      </span>
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500">
                                    No DNS instructions available yet.
                                  </span>
                                )}
                                {domain.error && (
                                  <p className="mt-1 text-[10px] text-red-300">
                                    {domain.error}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      handleRefreshDomainStatus(
                                        domain._id as any
                                      )
                                    }
                                    className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] text-slate-200 hover:border-sky-500 hover:text-sky-200 disabled:opacity-50"
                                  >
                                    Refresh
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      handleDeleteDomain(
                                        domain._id as any,
                                        domain.domain
                                      )
                                    }
                                    className="rounded-full border border-transparent bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <p className="text-[11px] text-slate-500">
                    Changes are synced via Convex in real time.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsFormOpen(false)}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-slate-500 hover:text-white disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-950 shadow-lg shadow-sky-500/40 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting
                        ? isEditMode
                          ? "Saving..."
                          : "Creating..."
                        : isEditMode
                        ? "Save changes"
                        : "Create site"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
};

function FormField({ label, description, required, children }: FormFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex items-center gap-1 font-medium text-slate-100">
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {description && (
        <span className="text-[11px] text-slate-400">{description}</span>
      )}
      <div className="mt-1">{children}</div>
    </label>
  );
}

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
      <div className="flex flex-1 flex-col text-[11px]">
        <span className="font-medium text-slate-200">{label}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
          {value}
        </span>
      </div>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-7 cursor-pointer rounded-md border border-slate-700 bg-transparent p-0"
      />
    </div>
  );
}

