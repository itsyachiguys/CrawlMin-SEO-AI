
export type Severity = "error" | "warning" | "notice";

export type LinkStatus =
    | "working"
    | "broken"
    | "unverified"
    | "redirected"
    | "rate_limited"
    | "server_error"
    | "invalid";

export interface SEOIssue {
    id: string;
    ruleId: string;
    title: string;
    severity: Severity;
    message: string;
    recommendation: string;
    pageUrl: string;
    category: string;
}

export interface BrokenLink {
    id: string;
    sourceUrl: string;
    destinationUrl: string;
    statusCode: number | null;
    linkType: "internal" | "external" | "unknown";
    linkStatus: LinkStatus;
    message: string;
}

export interface AuditMetrics {
    totalPages: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    notices: number;
    brokenLinks: number;
    unverifiedLinks: number;
}

export interface AuditResponse {
    status: string;
    audit_type: string;
    target_url: string;
    results: Record<string, any>;
}
