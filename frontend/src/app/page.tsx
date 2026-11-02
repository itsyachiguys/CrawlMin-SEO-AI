
"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileWarning,
  Globe,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";

import {
  normalizeIssues,
  normalizeBrokenLinks,
  calculateMetrics,
} from "@/lib/audit-utils";

import type {
  SEOIssue,
  BrokenLink,
  LinkStatus,
  FixProposal,
} from "@/types/audit";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AuditResponse = {
  status: string;
  audit_type: string;
  target_url: string;
  results: Record<string, any>;
};

type Tab = "overview" | "issues" | "links" | "fixes";

type IssueFilter = "all" | "error" | "warning" | "notice";

type LinkFilter = "broken" | "unverified" | "working";

export default function Home () {
  const [url, setUrl] = useState("https://example.com");
  const [maxPages, setMaxPages] = useState(10);
  const [checkLinks, setCheckLinks] = useState(true);
  const [maxLinkChecks, setMaxLinkChecks] = useState(100);
  const [singlePage, setSinglePage] = useState(false);
  const [proposalDecisions, setProposalDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditResponse | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [linkFilter, setLinkFilter] =
    useState<LinkFilter>("broken");

  const [search, setSearch] = useState("");

  const [selectedIssue, setSelectedIssue] =
    useState<SEOIssue | null>(null);

  const [selectedLink, setSelectedLink] =
    useState<BrokenLink | null>(null);

  const [showRawData, setShowRawData] = useState(false);

  function approveProposal (proposal: FixProposal) {
    if (
      proposal.suggested_value === null ||
      proposal.suggested_value === undefined
    ) {
      return;
    }

    setProposalDecisions(current => ({
      ...current,
      [proposal.proposal_id]: "approved",
    }));
  }

  function rejectProposal (proposal: FixProposal) {
    setProposalDecisions(current => ({
      ...current,
      [proposal.proposal_id]: "rejected",
    }));
  }

  function approveAllEligible () {
    setProposalDecisions(current => {
      const updated = { ...current };

      displayedFixProposals.forEach(proposal => {
        if (
          proposal.suggested_value !== null &&
          proposal.suggested_value !== undefined &&
          proposal.status === "manual_review"
        ) {
          updated[proposal.proposal_id] = "approved";
        }
      });

      return updated;
    });
  }
  async function runAudit (event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setAudit(null);
    setSelectedIssue(null);
    setSelectedLink(null);
    setSearch("");

    try {
      const response = await fetch(
        `${API_URL}/api/v1/audits`,
        {
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
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "The audit could not be completed."
        );
      }

      setAudit(data);
      setActiveTab("overview");
      setLinkFilter("broken");
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
  const fixProposals = useMemo<FixProposal[]>(() => {
    const pages = Array.isArray(results.pages)
      ? results.pages
      : [];

    return pages.flatMap((page: any) =>
      Array.isArray(page.fix_proposals)
        ? page.fix_proposals
        : []
    );
  }, [results]);

  const displayedFixProposals: FixProposal[] = fixProposals.map(
    (proposal): FixProposal => ({
      ...proposal,
      status: proposalDecisions[proposal.proposal_id] ?? proposal.status,
    })
  );

  const eligibleFixCount = displayedFixProposals.filter(
    proposal =>
      proposal.suggested_value !== null &&
      proposal.suggested_value !== undefined &&
      proposal.status === "manual_review"
  ).length;

  const issues = useMemo(
    () => normalizeIssues(results),
    [results]
  );

  const allLinks = useMemo(
    () => normalizeBrokenLinks(results),
    [results]
  );

  const brokenLinks = allLinks.filter(
    link => link.linkStatus === "broken"
  );

  const unverifiedLinks = allLinks.filter(
    link =>
      link.linkStatus === "unverified" ||
      link.linkStatus === "rate_limited" ||
      link.linkStatus === "server_error" ||
      link.linkStatus === "invalid"
  );

  const workingLinks = allLinks.filter(
    link =>
      link.linkStatus === "working" ||
      link.linkStatus === "redirected"
  );

  const metrics = useMemo(
    () =>
      calculateMetrics(
        results,
        issues,
        brokenLinks,
        unverifiedLinks
      ),
    [results, issues, brokenLinks, unverifiedLinks]
  );

  const filteredIssues = issues.filter(issue => {
    const matchesFilter =
      filter === "all" || issue.severity === filter;

    const query = search.toLowerCase();

    const matchesSearch =
      !query ||
      issue.title.toLowerCase().includes(query) ||
      issue.message.toLowerCase().includes(query) ||
      issue.pageUrl.toLowerCase().includes(query) ||
      issue.ruleId.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const filteredLinks = allLinks.filter(link => {
    let matchesCategory = false;

    if (linkFilter === "broken") {
      matchesCategory = link.linkStatus === "broken";
    } else if (linkFilter === "unverified") {
      matchesCategory = unverifiedLinks.some(
        item => item.id === link.id
      );
    } else {
      matchesCategory = workingLinks.some(
        item => item.id === link.id
      );
    }

    const query = search.toLowerCase();

    const matchesSearch =
      !query ||
      link.sourceUrl.toLowerCase().includes(query) ||
      link.destinationUrl.toLowerCase().includes(query) ||
      link.message.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const metricCards = [
    {
      label: "Pages crawled",
      value: metrics.totalPages,
      icon: Globe,
      color: "text-cyan-400",
    },
    {
      label: "Total SEO issues",
      value: metrics.totalIssues,
      icon: Activity,
      color: "text-red-400",
    },
    {
      label: "Errors",
      value: metrics.errors,
      icon: AlertCircle,
      color: "text-red-400",
    },
    {
      label: "Warnings",
      value: metrics.warnings,
      icon: AlertTriangle,
      color: "text-amber-400",
    },
    {
      label: "Notices",
      value: metrics.notices,
      icon: FileWarning,
      color: "text-blue-400",
    },
    {
      label: "Broken links",
      value: metrics.brokenLinks,
      icon: Link2,
      color: "text-orange-400",
    },
    {
      label: "Unverified links",
      value: metrics.unverifiedLinks,
      icon: AlertTriangle,
      color: "text-amber-400",
    },
  ];

  function severityStyle (severity: string) {
    switch (severity) {
      case "error":
        return "border-red-400/20 bg-red-400/10 text-red-300";
      case "warning":
        return "border-amber-400/20 bg-amber-400/10 text-amber-300";
      default:
        return "border-blue-400/20 bg-blue-400/10 text-blue-300";
    }
  }

  function linkStatusStyle (status: LinkStatus) {
    switch (status) {
      case "broken":
        return "bg-red-400/10 text-red-300";
      case "working":
      case "redirected":
        return "bg-emerald-400/10 text-emerald-300";
      default:
        return "bg-amber-400/10 text-amber-300";
    }
  }

  function linkStatusLabel (status: LinkStatus) {
    return status.replace(/_/g, " ");
  }

  function closeDetails () {
    setSelectedIssue(null);
    setSelectedLink(null);
  }

  function changeTab (tab: Tab) {
    setActiveTab(tab);
    closeDetails();
    setSearch("");
    setFilter("all");
  }

  const linkTabs = [
    {
      id: "broken" as const,
      label: "Broken",
      count: brokenLinks.length,
    },
    {
      id: "unverified" as const,
      label: "Unverified",
      count: unverifiedLinks.length,
    },
    {
      id: "working" as const,
      label: "Working",
      count: workingLinks.length,
    },
  ];

  return (
    <main className="min-h-screen bg-[#090d18] text-white">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}

        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0c1220] p-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-slate-950">
              C
            </div>

            <div>
              <h1 className="text-lg font-semibold">
                CrawlMin
              </h1>
              <p className="text-xs text-slate-500">
                SEO Intelligence
              </p>
            </div>
          </div>

          <div className="mt-12 space-y-2">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Workspace
            </p>

            <button
              onClick={() => changeTab("overview")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${activeTab === "overview"
                ? "bg-cyan-400/10 text-cyan-300"
                : "text-slate-400 hover:bg-white/5"
                }`}
            >
              <LayoutDashboard size={18} />
              Overview
            </button>

            <button
              onClick={() => changeTab("issues")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${activeTab === "issues"
                ? "bg-cyan-400/10 text-cyan-300"
                : "text-slate-400 hover:bg-white/5"
                }`}
            >
              <ShieldCheck size={18} />
              SEO Issues

              {audit && (
                <span className="ml-auto text-xs">
                  {issues.length}
                </span>
              )}
            </button>

            <button
              onClick={() => changeTab("links")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${activeTab === "links"
                ? "bg-cyan-400/10 text-cyan-300"
                : "text-slate-400 hover:bg-white/5"
                }`}
            >
              <Link2 size={18} />
              Link Intelligence

              {audit && (
                <span className="ml-auto text-xs">
                  {allLinks.length}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => changeTab("fixes")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${activeTab === "fixes"
              ? "bg-cyan-400/10 text-cyan-300"
              : "text-slate-400 hover:bg-white/5"
              }`}
          >
            <Zap size={18} />
            Fix Suggestions

            {audit && (
              <span className="ml-auto text-xs">
                {fixProposals.length}
              </span>
            )}
          </button>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap size={16} className="text-cyan-300" />
              CrawlMin Engine
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Powered by your Python SEO crawling and analysis engine.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Backend integration
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}

        <section className="min-w-0 flex-1">
          <header className="flex min-h-20 items-center justify-between border-b border-white/10 px-6 md:px-10">
            <div>
              <p className="text-xs text-slate-500">
                Workspace / {activeTab}
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                {activeTab === "overview"
                  ? "SEO Dashboard"
                  : activeTab === "issues"
                    ? "SEO Issues"
                    : activeTab === "links"
                      ? "Link Intelligence Explorer"
                      : "Fix Suggestions"}
              </h2>
            </div>

            <button
              onClick={() => {
                if (audit) {
                  setUrl(audit.target_url);
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              <RefreshCw size={14} />
              Latest audit
            </button>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">

            {/* INTRODUCTION */}

            <div>
              <p className="text-xs font-semibold tracking-widest text-cyan-300">
                WEBSITE INTELLIGENCE
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                {activeTab === "overview"
                  ? "Understand your website."
                  : activeTab === "issues"
                    ? "Find what needs fixing."
                    : activeTab === "links"
                      ? "Understand every destination."
                      : "Turn SEO findings into corrections."}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {activeTab === "overview"
                  ? "Analyze your website, identify technical SEO problems and understand its overall health."
                  : activeTab === "issues"
                    ? "Inspect detected SEO issues, their severity, affected pages and recommended corrections."
                    : activeTab === "links"
                      ? "Investigate broken, unverified and working links across your website."
                      : "Review proposed SEO corrections, compare original and suggested values, and manage approval decisions."}
              </p>
            </div>

            {/* AUDIT FORM */}

            <form
              onSubmit={runAudit}
              className="rounded-2xl border border-white/10 bg-[#111a2b] p-5 md:p-7"
            >
              <div className="mb-5 flex items-center gap-2">
                <Search size={19} className="text-cyan-300" />
                <h3 className="font-semibold">
                  Run website audit
                </h3>
              </div>

              <label className="mb-2 block text-sm text-slate-400">
                Website URL
              </label>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={event => setUrl(event.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090f1d] px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
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
                    onChange={event =>
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
                    onChange={event =>
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
                    onChange={event =>
                      setCheckLinks(event.target.checked)
                    }
                    className="accent-cyan-400"
                  />
                  Check links
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={singlePage}
                    onChange={event =>
                      setSinglePage(event.target.checked)
                    }
                    className="accent-cyan-400"
                  />
                  Single-page audit
                </label>
              </div>
            </form>

            {/* ERROR */}

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* LOADING */}

            {loading && (
              <div className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm text-cyan-300">
                <LoaderCircle className="animate-spin" size={20} />
                Your website is being analyzed. Please wait...
              </div>
            )}

            {/* AUDIT RESULTS */}

            {audit && (
              <div className="space-y-6">

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      Audit overview
                    </h3>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      {audit.target_url}
                    </p>
                  </div>

                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                    {audit.status}
                  </span>
                </div>

                {/* METRIC CARDS */}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {metricCards.map(metric => {
                    const Icon = metric.icon;

                    return (
                      <div
                        key={metric.label}
                        className="rounded-2xl border border-white/10 bg-[#111a2b] p-5"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-400">
                            {metric.label}
                          </p>

                          <Icon
                            size={20}
                            className={metric.color}
                          />
                        </div>

                        <p className="mt-4 text-3xl font-semibold">
                          {metric.value}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* TABS */}

                <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
                  {[
                    { id: "overview", label: "Overview" },
                    { id: "issues", label: "SEO Issues" },
                    { id: "links", label: "Link Intelligence" },
                    { id: "fixes", label: "Fix Suggestions" },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => changeTab(tab.id as Tab)}
                      className={`rounded-lg px-4 py-2 text-sm transition ${activeTab === tab.id
                        ? "bg-cyan-400/10 text-cyan-300"
                        : "text-slate-400 hover:bg-white/5"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* OVERVIEW */}

                {activeTab === "overview" && (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-5">
                      <h3 className="font-semibold">
                        Issue distribution
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Detected issues grouped by severity
                      </p>

                      <div className="mt-6 space-y-5">
                        {[
                          {
                            label: "Errors",
                            count: metrics.errors,
                            color: "bg-red-400",
                          },
                          {
                            label: "Warnings",
                            count: metrics.warnings,
                            color: "bg-amber-400",
                          },
                          {
                            label: "Notices",
                            count: metrics.notices,
                            color: "bg-blue-400",
                          },
                        ].map(item => {
                          const percentage =
                            metrics.totalIssues > 0
                              ? (item.count / metrics.totalIssues) * 100
                              : 0;

                          return (
                            <div key={item.label}>
                              <div className="mb-2 flex justify-between text-sm">
                                <span className="text-slate-300">
                                  {item.label}
                                </span>
                                <span className="text-slate-400">
                                  {item.count}
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                                <div
                                  className={`h-full rounded-full ${item.color}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-5">
                      <h3 className="font-semibold">
                        Link health
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Classification of discovered links
                      </p>

                      <div className="mt-5 space-y-3">
                        {[
                          {
                            label: "Working",
                            count: workingLinks.length,
                            color: "text-emerald-300",
                            icon: CheckCircle2,
                          },
                          {
                            label: "Broken",
                            count: brokenLinks.length,
                            color: "text-red-300",
                            icon: Link2,
                          },
                          {
                            label: "Unverified",
                            count: unverifiedLinks.length,
                            color: "text-amber-300",
                            icon: AlertTriangle,
                          },
                        ].map(item => {
                          const Icon = item.icon;

                          return (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-xl border border-white/10 p-4"
                            >
                              <div className="flex items-center gap-3">
                                <Icon size={18} className={item.color} />
                                <span className="text-sm text-slate-300">
                                  {item.label}
                                </span>
                              </div>

                              <span className={`text-lg font-semibold ${item.color}`}>
                                {item.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => changeTab("links")}
                        className="mt-4 flex w-full items-center justify-between rounded-xl bg-cyan-400/10 p-4 text-sm text-cyan-300 hover:bg-cyan-400/15"
                      >
                        Open Link Intelligence
                        <ChevronRight size={17} />
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#111a2b] p-5 xl:col-span-2">
                      <h3 className="font-semibold">
                        Quick access
                      </h3>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <button
                          onClick={() => changeTab("issues")}
                          className="flex items-center justify-between rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <AlertCircle className="text-red-400" />
                            <div>
                              <p className="text-sm font-medium">
                                SEO Issues
                              </p>
                              <p className="text-xs text-slate-500">
                                {issues.length} detected records
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={17} />
                        </button>

                        <button
                          onClick={() => changeTab("links")}
                          className="flex items-center justify-between rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <Link2 className="text-cyan-400" />
                            <div>
                              <p className="text-sm font-medium">
                                Link Intelligence
                              </p>
                              <p className="text-xs text-slate-500">
                                {allLinks.length} discovered links
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SEO ISSUES */}

                {activeTab === "issues" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          Detected SEO issues
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Select an issue to inspect its details
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(
                          ["all", "error", "warning", "notice"] as IssueFilter[]
                        ).map(item => (
                          <button
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`rounded-lg border px-3 py-2 text-xs capitalize ${filter === item
                              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                              : "border-white/10 text-slate-400 hover:bg-white/5"
                              }`}
                          >
                            {item === "all" ? "All issues" : item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      />

                      <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search issue, rule ID or URL..."
                        className="w-full rounded-xl border border-white/10 bg-[#111a2b] py-3 pl-11 pr-4 text-sm outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111a2b]">
                      <table className="w-full min-w-[750px] text-left text-sm">
                        <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-4">Issue</th>
                            <th className="px-5 py-4">Rule ID</th>
                            <th className="px-5 py-4">Severity</th>
                            <th className="px-5 py-4">Affected page</th>
                            <th className="px-5 py-4">Details</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/5">
                          {filteredIssues.map(issue => (
                            <tr
                              key={issue.id}
                              onClick={() => {
                                setSelectedIssue(issue);
                                setSelectedLink(null);
                              }}
                              className="cursor-pointer transition hover:bg-white/[0.04]"
                            >
                              <td className="max-w-[230px] px-5 py-4 font-medium text-slate-200">
                                {issue.title}
                              </td>

                              <td className="px-5 py-4 text-xs text-slate-500">
                                {issue.ruleId}
                              </td>

                              <td className="px-5 py-4">
                                <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${severityStyle(issue.severity)}`}>
                                  {issue.severity}
                                </span>
                              </td>

                              <td className="max-w-[220px] truncate px-5 py-4 text-xs text-slate-400">
                                {issue.pageUrl || "Not provided"}
                              </td>

                              <td className="px-5 py-4">
                                <ChevronRight size={17} className="text-slate-500" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {filteredIssues.length === 0 && (
                        <div className="p-10 text-center text-sm text-slate-500">
                          No matching SEO issue records were returned.
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* FIX SUGGESTIONS */}

                {activeTab === "fixes" && (
                  <div className="space-y-5">

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          SEO Fix Suggestions
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Review proposed corrections before approving them.
                        </p>
                      </div>

                      <button
                        onClick={approveAllEligible}
                        disabled={eligibleFixCount === 0}
                        className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Approve all eligible ({eligibleFixCount})
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        {
                          label: "Total proposals",
                          value: displayedFixProposals.length,
                        },
                        {
                          label: "Needs review",
                          value: displayedFixProposals.filter(
                            p => p.status === "needs_review"
                          ).length,
                        },
                        {
                          label: "Manual review",
                          value: displayedFixProposals.filter(
                            p => p.status === "manual_review"
                          ).length,
                        },
                      ].map(item => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white/10 bg-[#111a2b] p-4"
                        >
                          <p className="text-xs text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-2 text-2xl font-semibold">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {displayedFixProposals.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                        <CheckCircle2
                          size={30}
                          className="mx-auto text-slate-500"
                        />
                        <p className="mt-3 text-sm text-slate-400">
                          No fix proposals are available for this audit.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedFixProposals.map(proposal => {
                          const hasSuggestion =
                            proposal.suggested_value !== null &&
                            proposal.suggested_value !== undefined;

                          const statusStyle =
                            proposal.status === "approved"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : proposal.status === "rejected"
                                ? "bg-red-400/10 text-red-300"
                                : proposal.status === "manual_review"
                                  ? "bg-amber-400/10 text-amber-300"
                                  : "bg-cyan-400/10 text-cyan-300";

                          return (
                            <div
                              key={proposal.proposal_id}
                              className="rounded-2xl border border-white/10 bg-[#111a2b] p-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h4 className="font-semibold text-slate-100">
                                    {proposal.rule_id.replace(/_/g, " ")}
                                  </h4>
                                  <p className="mt-1 break-all text-xs text-slate-500">
                                    {proposal.page_url}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-lg bg-white/5 px-3 py-1 text-xs capitalize text-slate-300">
                                    {proposal.risk} risk
                                  </span>

                                  <span className={`rounded-lg px-3 py-1 text-xs ${statusStyle}`}>
                                    {proposal.status.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </div>

                              <p className="mt-4 text-sm leading-6 text-slate-400">
                                {proposal.message}
                              </p>

                              <div className="mt-5 grid gap-4 md:grid-cols-2">

                                <div className="rounded-xl border border-white/10 bg-[#090f1d] p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Original value
                                  </p>

                                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
                                    {proposal.original_value === null ||
                                      proposal.original_value === undefined
                                      ? "Not available"
                                      : typeof proposal.original_value === "string"
                                        ? proposal.original_value
                                        : JSON.stringify(proposal.original_value, null, 2)}
                                  </pre>
                                </div>

                                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                                    Suggested value
                                  </p>

                                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
                                    {hasSuggestion
                                      ? typeof proposal.suggested_value === "string"
                                        ? proposal.suggested_value
                                        : JSON.stringify(proposal.suggested_value, null, 2)
                                      : "A suggested value has not been generated yet."}
                                  </pre>
                                </div>

                              </div>

                              <div className="mt-4 rounded-xl border border-white/10 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Review notes
                                </p>

                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                  {proposal.reason}
                                </p>

                                <p className="mt-2 text-xs text-slate-500">
                                  Recommendation: {proposal.recommendation}
                                </p>
                              </div>

                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                  {hasSuggestion
                                    ? "Review the suggested value before approving."
                                    : "This proposal requires manual review."}
                                </p>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => rejectProposal(proposal)}
                                    disabled={
                                      proposal.status === "rejected" ||
                                      proposal.status === "approved"
                                    }
                                    className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
                                  >
                                    Reject
                                  </button>

                                  <button
                                    onClick={() => approveProposal(proposal)}
                                    disabled={
                                      !hasSuggestion ||
                                      proposal.status === "approved" ||
                                      proposal.status === "rejected"
                                    }
                                    className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Approve
                                  </button>
                                </div>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-200">
                      Approval currently records a review decision in this browser
                      session only. It does not modify website files or publish
                      changes to a website.
                    </div>

                  </div>
                )}


                {/* LINK INTELLIGENCE */}

                {activeTab === "links" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">
                        Link intelligence explorer
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Investigate working, broken and unverified destinations
                      </p>
                    </div>

                    {/* LINK CATEGORY FILTERS */}

                    <div className="grid gap-3 sm:grid-cols-3">
                      {linkTabs.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setLinkFilter(item.id);
                            setSelectedLink(null);
                            setSearch("");
                          }}
                          className={`rounded-xl border p-4 text-left transition ${linkFilter === item.id
                            ? "border-cyan-400/30 bg-cyan-400/10"
                            : "border-white/10 bg-[#111a2b] hover:bg-white/[0.04]"
                            }`}
                        >
                          <p className="text-sm text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-2 text-2xl font-semibold">
                            {item.count}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      />

                      <input
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search source URL or destination..."
                        className="w-full rounded-xl border border-white/10 bg-[#111a2b] py-3 pl-11 pr-4 text-sm outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111a2b]">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-5 py-4">Source page</th>
                            <th className="px-5 py-4">Destination</th>
                            <th className="px-5 py-4">Type</th>
                            <th className="px-5 py-4">HTTP status</th>
                            <th className="px-5 py-4">Classification</th>
                            <th className="px-5 py-4">Details</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/5">
                          {filteredLinks.map(link => (
                            <tr
                              key={link.id}
                              onClick={() => {
                                setSelectedLink(link);
                                setSelectedIssue(null);
                              }}
                              className="cursor-pointer transition hover:bg-white/[0.04]"
                            >
                              <td className="max-w-[180px] truncate px-5 py-4 text-xs text-slate-400">
                                {link.sourceUrl || "Not provided"}
                              </td>

                              <td className="max-w-[220px] truncate px-5 py-4 text-xs text-slate-200">
                                {link.destinationUrl}
                              </td>

                              <td className="px-5 py-4 text-xs capitalize text-slate-400">
                                {link.linkType}
                              </td>

                              <td className="px-5 py-4 text-xs text-slate-300">
                                {link.statusCode ?? "No response"}
                              </td>

                              <td className="px-5 py-4">
                                <span className={`rounded-lg px-2.5 py-1 text-xs capitalize ${linkStatusStyle(link.linkStatus)}`}>
                                  {linkStatusLabel(link.linkStatus)}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <ChevronRight size={17} className="text-slate-500" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {filteredLinks.length === 0 && (
                        <div className="p-10 text-center">
                          <CheckCircle2
                            size={28}
                            className="mx-auto text-slate-600"
                          />

                          <p className="mt-3 text-sm text-slate-400">
                            {linkFilter === "broken"
                              ? "No confirmed broken links found."
                              : linkFilter === "unverified"
                                ? "No unverified links found."
                                : "No working links found in this audit."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SELECTED RECORD DETAILS */}

                {(selectedIssue || selectedLink) && (
                  <div className="rounded-2xl border border-cyan-400/20 bg-[#111a2b] p-5 md:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                          {selectedIssue
                            ? <AlertCircle size={20} />
                            : <Link2 size={20} />}
                        </div>

                        <div>
                          <p className="text-xs text-cyan-300">
                            SELECTED RECORD
                          </p>

                          <h3 className="mt-1 font-semibold">
                            {selectedIssue
                              ? selectedIssue.title
                              : selectedLink?.linkStatus === "broken"
                                ? "Broken link details"
                                : selectedLink?.linkStatus === "working" ||
                                  selectedLink?.linkStatus === "redirected"
                                  ? "Working link details"
                                  : "Unverified link details"}
                          </h3>
                        </div>
                      </div>

                      <button
                        onClick={closeDetails}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
                        aria-label="Close details"
                      >
                        <X size={19} />
                      </button>
                    </div>

                    {/* SEO ISSUE DETAILS */}

                    {selectedIssue && (
                      <div className="mt-6 space-y-5">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs capitalize ${severityStyle(selectedIssue.severity)}`}>
                            {selectedIssue.severity}
                          </span>

                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                            {selectedIssue.ruleId}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Description
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {selectedIssue.message}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Affected URL
                          </p>
                          <p className="mt-2 break-all text-sm text-cyan-300">
                            {selectedIssue.pageUrl || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Recommended correction
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {selectedIssue.recommendation}
                          </p>
                        </div>

                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200">
                          Fix functionality is not enabled yet. This version provides inspection and recommendations only.
                        </div>
                      </div>
                    )}

                    {/* LINK DETAILS */}

                    {selectedLink && (
                      <div className="mt-6 space-y-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Source page
                          </p>
                          <p className="mt-2 break-all text-sm text-cyan-300">
                            {selectedLink.sourceUrl || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Destination
                          </p>
                          <p className="mt-2 break-all text-sm text-slate-200">
                            {selectedLink.destinationUrl}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-xl border border-white/10 p-4">
                            <p className="text-xs text-slate-500">
                              HTTP status
                            </p>
                            <p className="mt-2 text-xl font-semibold">
                              {selectedLink.statusCode ?? "Unknown"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 p-4">
                            <p className="text-xs text-slate-500">
                              Link type
                            </p>
                            <p className="mt-2 text-xl font-semibold capitalize">
                              {selectedLink.linkType}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 p-4">
                            <p className="text-xs text-slate-500">
                              Classification
                            </p>
                            <p className="mt-2 text-sm font-semibold capitalize">
                              {linkStatusLabel(selectedLink.linkStatus)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Verification details
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {selectedLink.message}
                          </p>
                        </div>

                        {selectedLink.linkStatus === "unverified" ||
                          selectedLink.linkStatus === "rate_limited" ||
                          selectedLink.linkStatus === "server_error" ? (
                          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-200">
                            CrawlMin could not conclusively verify this destination. This does not necessarily mean the link is broken.
                          </div>
                        ) : null}

                        <a
                          href={selectedLink.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                        >
                          Inspect destination
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* RAW JSON */}

                <div className="rounded-2xl border border-white/10 bg-[#111a2b]">
                  <button
                    onClick={() => setShowRawData(!showRawData)}
                    className="flex w-full items-center justify-between p-5 text-sm font-medium"
                  >
                    Raw audit response

                    <ChevronRight
                      size={18}
                      className={`transition-transform ${showRawData ? "rotate-90" : ""
                        }`}
                    />
                  </button>

                  {showRawData && (
                    <pre className="max-h-[500px] overflow-auto border-t border-white/10 p-5 text-xs leading-6 text-cyan-100">
                      {JSON.stringify(audit.results, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!audit && !loading && (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <Globe
                  size={35}
                  className="mx-auto text-slate-600"
                />

                <h3 className="mt-4 font-medium">
                  No audit results yet
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Enter a website URL above to start your first analysis.
                </p>
              </div>
            )}

            <footer className="border-t border-white/10 pt-6 text-xs text-slate-600">
              CrawlMin SEO AI · Development build · Version 0.2.1
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
