
import type {
    SEOIssue,
    BrokenLink,
    AuditMetrics,
    Severity,
} from "@/types/audit";

type Data = Record<string, any>;

function asObject (value: any): Data {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function asArray (value: any): any[] {
    return Array.isArray(value) ? value : [];
}

function getPages (results: Data): Data[] {
    const pages =
        results.pages ??
        results.page_results ??
        results.crawled_pages ??
        [];

    if (Array.isArray(pages)) return pages;

    return [];
}

function getSeverity (value: any): Severity {
    const severity = String(value ?? "").toLowerCase();

    if (
        ["error", "critical", "high", "fatal"].includes(severity)
    ) {
        return "error";
    }

    if (
        ["warning", "medium"].includes(severity)
    ) {
        return "warning";
    }

    return "notice";
}

export function normalizeIssues (results: Data): SEOIssue[] {
    const pages = getPages(results);
    const issues: SEOIssue[] = [];

    pages.forEach((page, pageIndex) => {
        const pageUrl = String(page.url ?? page.page_url ?? "");

        const pageIssues = asArray(
            page.seo_issues ?? page.issues
        );

        pageIssues.forEach((issue, issueIndex) => {
            issues.push({
                id: `${pageIndex}-${issueIndex}`,
                ruleId: String(
                    issue.rule_id ?? issue.ruleId ?? "SEO-UNKNOWN"
                ),
                title: String(
                    issue.title ?? issue.rule_id ?? issue.message ?? "SEO issue"
                ),
                severity: getSeverity(issue.severity),
                message: String(
                    issue.message ?? issue.description ?? "No description available."
                ),
                recommendation: String(
                    issue.recommendation ??
                    issue.suggestion ??
                    "Review this page and correct the detected issue."
                ),
                pageUrl: String(issue.page_url ?? pageUrl),
                category: String(issue.category ?? "On-page SEO"),
            });
        });
    });

    // Also support engines that return a site-level issue list.
    const siteIssues = asArray(results.seo_issues);

    siteIssues.forEach((issue, index) => {
        if (issues.some(
            existing =>
                existing.ruleId === String(issue.rule_id ?? "") &&
                existing.pageUrl === String(issue.page_url ?? issue.url ?? "")
        )) {
            return;
        }

        issues.push({
            id: `site-${index}`,
            ruleId: String(issue.rule_id ?? "SEO-UNKNOWN"),
            title: String(
                issue.title ?? issue.rule_id ?? issue.message ?? "SEO issue"
            ),
            severity: getSeverity(issue.severity),
            message: String(
                issue.message ?? issue.description ?? "No description available."
            ),
            recommendation: String(
                issue.recommendation ?? issue.suggestion ?? "Review this issue."
            ),
            pageUrl: String(issue.page_url ?? issue.url ?? ""),
            category: String(issue.category ?? "On-page SEO"),
        });
    });

    return issues;
}

function getLinkStatus (link: Data): number | null {
    const value =
        link.status_code ??
        link.status ??
        link.http_status ??
        link.statusCode;

    const number = Number(value);

    return Number.isFinite(number) && value !== null && value !== ""
        ? number
        : null;
}


function isBroken (link: Data): boolean {
    // Trust the backend's explicit classification first.
    if (typeof link.is_broken === "boolean") {
        return link.is_broken;
    }

    if (typeof link.broken === "boolean") {
        return link.broken;
    }

    // Use the backend's classification when available.
    const linkStatus = String(
        link.link_status ?? ""
    ).toLowerCase();

    if (linkStatus) {
        return linkStatus === "broken";
    }

    // Conservative fallback for older audit responses.
    const status = getLinkStatus(link);

    return status === 404 || status === 410;
}


export function normalizeBrokenLinks (results: Data): BrokenLink[] {
    const pages = getPages(results);
    const brokenLinks: BrokenLink[] = [];

    pages.forEach((page, pageIndex) => {
        const sourceUrl = String(page.url ?? page.page_url ?? "");

        const links = asArray(
            page.link_results ?? page.links
        );

        links.forEach((link, linkIndex) => {
            if (!isBroken(asObject(link))) return;

            const destinationUrl = String(
                link.url ??
                link.href ??
                link.destination_url ??
                link.target_url ??
                ""
            );

            if (!destinationUrl) return;

            let linkType: BrokenLink["linkType"] = "unknown";

            try {
                const source = new URL(sourceUrl);
                const destination = new URL(destinationUrl, sourceUrl);

                linkType =
                    source.hostname === destination.hostname
                        ? "internal"
                        : "external";
            } catch {
                linkType = "unknown";
            }

            brokenLinks.push({
                id: `${pageIndex}-${linkIndex}`,
                sourceUrl,
                destinationUrl,
                statusCode: getLinkStatus(link),
                linkType,
                message: String(
                    link.message ??
                    link.error ??
                    "The destination could not be reached successfully."
                ),
            });
        });
    });

    // Support a site-level broken-link list as well.
    const siteLinks = asArray(results.link_results);

    siteLinks.forEach((link, index) => {
        const item = asObject(link);

        if (!isBroken(item)) return;

        const destinationUrl = String(
            item.url ??
            item.href ??
            item.destination_url ??
            item.target_url ??
            ""
        );

        if (!destinationUrl) return;

        const sourceUrl = String(
            item.source_url ?? item.source_page ?? ""
        );

        if (brokenLinks.some(
            existing =>
                existing.sourceUrl === sourceUrl &&
                existing.destinationUrl === destinationUrl
        )) {
            return;
        }

        let linkType: BrokenLink["linkType"] = "unknown";

        try {
            const source = new URL(sourceUrl);
            const destination = new URL(destinationUrl, sourceUrl);

            linkType =
                source.hostname === destination.hostname
                    ? "internal"
                    : "external";
        } catch {
            linkType = "unknown";
        }

        brokenLinks.push({
            id: `site-${index}`,
            sourceUrl,
            destinationUrl,
            statusCode: getLinkStatus(item),
            linkType,
            message: String(item.message ?? item.error ?? "Broken link"),
        });
    });

    return brokenLinks;
}

export function calculateMetrics (
    results: Data,
    issues: SEOIssue[],
    links: BrokenLink[]
): AuditMetrics {
    const pages = getPages(results);

    const summary = asObject(
        results.seo_summary ?? results.summary
    );

    const count = (severity: Severity) =>
        issues.filter(issue => issue.severity === severity).length;

    return {
        totalPages: Number(
            summary.total_pages ??
            summary.pages_crawled ??
            results.pages_crawled ??
            pages.length
        ),
        totalIssues: issues.length,
        errors: count("error"),
        warnings: count("warning"),
        notices: count("notice"),
        brokenLinks: links.length,
    };
}
