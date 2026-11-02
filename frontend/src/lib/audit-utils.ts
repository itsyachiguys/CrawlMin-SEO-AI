
import type {
    SEOIssue,
    BrokenLink,
    AuditMetrics,
    Severity,
    LinkStatus,
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

    return Array.isArray(pages) ? pages : [];
}

function getSeverity (value: any): Severity {
    const severity = String(value ?? "").toLowerCase();

    if (["error", "critical", "high", "fatal"].includes(severity)) {
        return "error";
    }

    if (["warning", "medium"].includes(severity)) {
        return "warning";
    }

    return "notice";
}

function getLinkStatusCode (link: Data): number | null {
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


function getLinkClassification (link: Data): LinkStatus {
    const explicitStatus = String(
        link.link_status ?? ""
    ).toLowerCase();

    const validStatuses: LinkStatus[] = [
        "working",
        "broken",
        "unverified",
        "redirected",
        "rate_limited",
        "server_error",
        "invalid",
    ];

    if (validStatuses.includes(explicitStatus as LinkStatus)) {
        return explicitStatus as LinkStatus;
    }

    if (link.is_broken === true || link.broken === true) {
        return "broken";
    }

    const status = getLinkStatusCode(link);

    if (status !== null) {
        if (status >= 200 && status < 300) return "working";
        if (status >= 300 && status < 400) return "redirected";
        if (status === 404 || status === 410) return "broken";
        if (status === 429) return "rate_limited";
        if (status >= 500) return "server_error";
        if (status >= 400) return "unverified";
    }

    return "unverified";
}


function getLinkType (
    sourceUrl: string,
    destinationUrl: string
): BrokenLink["linkType"] {
    try {
        const destination = new URL(destinationUrl, sourceUrl);

        if (!sourceUrl) return "unknown";

        const source = new URL(sourceUrl);

        return source.hostname === destination.hostname
            ? "internal"
            : "external";
    } catch {
        return "unknown";
    }
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
                    issue.title ??
                    issue.rule_id ??
                    issue.message ??
                    "SEO issue"
                ),
                severity: getSeverity(issue.severity),
                message: String(
                    issue.message ??
                    issue.description ??
                    "No description available."
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

    // Also support site-level SEO issue lists.
    const siteIssues = asArray(results.seo_issues);

    siteIssues.forEach((issue, index) => {
        const ruleId = String(issue.rule_id ?? "SEO-UNKNOWN");
        const pageUrl = String(issue.page_url ?? issue.url ?? "");

        if (
            issues.some(
                existing =>
                    existing.ruleId === ruleId &&
                    existing.pageUrl === pageUrl
            )
        ) {
            return;
        }

        issues.push({
            id: `site-${index}`,
            ruleId,
            title: String(
                issue.title ??
                issue.rule_id ??
                issue.message ??
                "SEO issue"
            ),
            severity: getSeverity(issue.severity),
            message: String(
                issue.message ??
                issue.description ??
                "No description available."
            ),
            recommendation: String(
                issue.recommendation ??
                issue.suggestion ??
                "Review this issue."
            ),
            pageUrl,
            category: String(issue.category ?? "On-page SEO"),
        });
    });

    return issues;
}

/**
 * Returns all discovered links, not just broken links.
 * The dashboard filters them into working, broken and unverified groups.
 */
export function normalizeBrokenLinks (results: Data): BrokenLink[] {
    const pages = getPages(results);
    const normalizedLinks: BrokenLink[] = [];

    function addLink (
        linkValue: any,
        sourceUrl: string,
        id: string
    ) {
        const link = asObject(linkValue);

        const destinationUrl = String(
            link.url ??
            link.href ??
            link.destination_url ??
            link.target_url ??
            ""
        );

        if (!destinationUrl) return;

        normalizedLinks.push({
            id,
            sourceUrl,
            destinationUrl,
            statusCode: getLinkStatusCode(link),
            linkType: getLinkType(sourceUrl, destinationUrl),
            linkStatus: getLinkClassification(link),
            message: String(
                link.message ??
                link.error ??
                "No additional verification details available."
            ),
        });
    }

    pages.forEach((page, pageIndex) => {
        const sourceUrl = String(
            page.url ?? page.page_url ?? ""
        );

        const links = asArray(
            page.link_results ?? page.links
        );

        links.forEach((link, linkIndex) => {
            addLink(
                link,
                sourceUrl,
                `${pageIndex}-${linkIndex}`
            );
        });
    });

    // Support site-level link results too.
    const siteLinks = asArray(results.link_results);

    siteLinks.forEach((link, index) => {
        const item = asObject(link);

        const sourceUrl = String(
            item.source_url ?? item.source_page ?? ""
        );

        addLink(item, sourceUrl, `site-${index}`);
    });

    // Avoid duplicate records returned at both page and site level.
    return normalizedLinks.filter((link, index, array) => {
        return (
            array.findIndex(
                item =>
                    item.sourceUrl === link.sourceUrl &&
                    item.destinationUrl === link.destinationUrl
            ) === index
        );
    });
}

export function calculateMetrics (
    results: Data,
    issues: SEOIssue[],
    brokenLinks: BrokenLink[],
    unverifiedLinks: BrokenLink[] = []
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
        brokenLinks: brokenLinks.length,
        unverifiedLinks: unverifiedLinks.length,
    };
}
