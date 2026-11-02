
"use client";

import { FormEvent, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Globe,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AuditResponse = {
  status: string;
  audit_type: string;
  target_url: string;
  results: Record<string, any>;
};

export default function Home () {
  const [url, setUrl] = useState("https://example.com");
  const [maxPages, setMaxPages] = useState(10);
  const [checkLinks, setCheckLinks] = useState(true);
  const [maxLinkChecks, setMaxLinkChecks] = useState(100);
  const [singlePage, setSinglePage] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditResponse | null>(null);

  async function runAudit (event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setAudit(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/audits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          max_pages: maxPages,
          check_links: checkLinks,
          max_link_checks: maxLinkChecks,
          single_page: singlePage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "The audit could not be completed."
        );
      }

      setAudit(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the CrawlMin backend."
      );
    } finally {
      setLoading(false);
    }
  }

  const results = audit?.results ?? {};
  const summary = results.summary ?? {};
  const linkSummary = results.link_summary ?? {};

  const pages =
    results.pages ?? results.page_results ?? [];

  const totalPages =
    summary.total_pages ??
    summary.pages_crawled ??
    results.pages_crawled ??
    pages.length;

  const totalIssues =
    summary.total_issues ??
    results.total_issues ??
    results.pages_reported ??
    pages.reduce(
      (total: number, page: any) =>
        total + (page.issue_count ?? page.issues?.length ?? 0),
      0
    );

  const brokenLinks =
    linkSummary.broken_links ?? 0;

  const metrics = [
    {
      label: "Pages crawled",
      value: totalPages,
      icon: Globe,
    },
    {
      label: "SEO issues",
      value: totalIssues,
      icon: Activity,
    },
    {
      label: "Broken links",
      value: brokenLinks,
      icon: Link2,
    },
  ];

  return (
    <main className="min-h-screen bg-[#090d18] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0c1220] p-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-slate-950">
              C
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                CrawlMin
              </h1>
              <p className="text-xs text-slate-500">SEO Intelligence</p>
            </div>
          </div>

          <div className="mt-12 space-y-2">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Workspace
            </p>

            <div className="flex items-center gap-3 rounded-xl bg-cyan-400/10 px-4 py-3 text-cyan-300">
              <LayoutDashboard size={18} />
              <span className="text-sm font-medium">Overview</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400">
              <Globe size={18} />
              <span className="text-sm">Website audits</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400">
              <ShieldCheck size={18} />
              <span className="text-sm">SEO issues</span>
            </div>
          </div>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap size={16} className="text-cyan-300" />
              CrawlMin Engine
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Your SEO auditing engine is connected through the API.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
            <div>
              <p className="text-sm text-slate-400">Workspace / Overview</p>
              <h2 className="text-lg font-semibold">SEO Dashboard</h2>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              API connected
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
            <div>
              <p className="text-sm font-medium text-cyan-300">
                WEBSITE INTELLIGENCE
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Understand your website.
                <br />
                <span className="text-slate-400">
                  Improve its performance.
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Crawl your website, identify technical SEO issues,
                and get a structured overview of what needs attention.
              </p>
            </div>

            <form
              onSubmit={runAudit}
              className="rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-7"
            >
              <div className="mb-5 flex items-center gap-2">
                <Search size={19} className="text-cyan-300" />
                <h3 className="font-semibold">Start a website audit</h3>
              </div>

              <label className="mb-2 block text-sm text-slate-400">
                Website URL
              </label>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090f1d] px-4 py-3 text-sm outline-none transition focus:border-cyan-400"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={17} className="animate-spin" />
                      Auditing...
                    </>
                  ) : (
                    <>
                      Run SEO audit
                      <ArrowUpRight size={17} />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Maximum pages
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxPages}
                    disabled={singlePage}
                    onChange={(event) =>
                      setMaxPages(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090f1d] px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Maximum link checks
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxLinkChecks}
                    disabled={!checkLinks || singlePage}
                    onChange={(event) =>
                      setMaxLinkChecks(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#090f1d] px-4 py-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={checkLinks}
                    disabled={singlePage}
                    onChange={(event) =>
                      setCheckLinks(event.target.checked)
                    }
                    className="accent-cyan-400"
                  />
                  Check broken links
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={singlePage}
                    onChange={(event) =>
                      setSinglePage(event.target.checked)
                    }
                    className="accent-cyan-400"
                  />
                  Single-page audit
                </label>
              </div>
            </form>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Audit overview</h3>
                <span className="text-xs text-slate-500">
                  {audit ? "Latest audit results" : "Awaiting first audit"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-[#111a2b] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400">
                        {metric.label}
                      </p>
                      <metric.icon size={19} className="text-cyan-300" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold">
                      {audit ? metric.value : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {audit && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Audit results</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {audit.target_url}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                    {audit.status}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111a2b]">
                  <div className="border-b border-white/10 px-5 py-4">
                    <h4 className="text-sm font-medium">
                      Raw audit response
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Complete JSON returned by the CrawlMin API
                    </p>
                  </div>

                  <pre className="max-h-[500px] overflow-auto p-5 text-xs leading-6 text-cyan-100">
                    {JSON.stringify(audit.results, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <footer className="border-t border-white/10 pt-6 text-xs text-slate-600">
              CrawlMin SEO AI · Development build · Version 0.1.0
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
