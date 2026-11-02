from crawlmin.crawler import crawl_page, crawl_site
from crawlmin.seo_rules import analyze_seo
from crawlmin.fix_engine import generate_fix_proposals


def build_fix_summary(pages: list) -> dict:
    proposals = [
        proposal
        for page in pages
        for proposal in page.get("fix_proposals", [])
    ]

    return {
        "total_proposals": len(proposals),
        "needs_review": sum(
            proposal["status"] == "needs_review"
            for proposal in proposals
        ),
        "manual_review": sum(
            proposal["status"] == "manual_review"
            for proposal in proposals
        ),
        "automatically_applicable": sum(
            proposal.get("auto_applicable", False)
            for proposal in proposals
        ),
    }


def run_audit(
    url: str,
    max_pages: int = 10,
    check_links: bool = False,
    max_link_checks: int = 100,
    single_page: bool = False,
) -> dict:

    # SINGLE-PAGE AUDIT
    if single_page:
        page = crawl_page(url)
        issues = analyze_seo(page)

        proposals = generate_fix_proposals(
            page,
            issues,
        )

        page_result = {
            "url": page.get("final_url", url),
            "status_code": page.get("status_code"),
            "issues": issues,
            "issue_count": len(issues),
            "fix_proposals": proposals,
        }

        fix_summary = build_fix_summary([page_result])

        return {
            "target_url": url,
            "pages_crawled": 1,
            "pages": [page_result],
            "summary": {
                "total_pages": 1,
                "total_issues": len(issues),
                "total_fix_proposals": len(proposals),
            },
            "fix_summary": fix_summary,
        }

    # WEBSITE AUDIT
    results = crawl_site(
        start_url=url,
        max_pages=max_pages,
        check_links=check_links,
        max_link_checks=max_link_checks,
    )

    pages = results.get("pages", [])

    for page in pages:
        issues = page.get("seo_issues", [])

        proposals = generate_fix_proposals(
            page,
            issues,
        )

        page["fix_proposals"] = proposals

    # AGGREGATE FIX SUMMARY
    fix_summary = build_fix_summary(pages)

    results.setdefault("summary", {})
    results["summary"]["total_fix_proposals"] = (
        fix_summary["total_proposals"]
    )

    results["fix_summary"] = fix_summary

    return results