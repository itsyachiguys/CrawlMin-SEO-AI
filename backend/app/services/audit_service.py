
from crawlmin.crawler import crawl_page, crawl_site
from crawlmin.seo_rules import analyze_seo
from crawlmin.fix_engine import generate_fix_proposals


def run_audit(
    url: str,
    max_pages: int = 10,
    check_links: bool = False,
    max_link_checks: int = 100,
    single_page: bool = False,
) -> dict:

    if single_page:
        page = crawl_page(url)
        issues = analyze_seo(page)

        page["seo_issues"] = issues
        page["fix_proposals"] = generate_fix_proposals(
            page,
            issues,
        )

        return {
            "target_url": url,
            "pages_crawled": 1,
            "pages": [
                {
                    "url": page.get("final_url", url),
                    "status_code": page.get("status_code"),
                    "issues": issues,
                    "issue_count": len(issues),
                    "fix_proposals": page["fix_proposals"],
                }
            ],
            "summary": {
                "total_pages": 1,
                "total_issues": len(issues),
                "total_fix_proposals": len(page["fix_proposals"]),
            },
        }

    results = crawl_site(
        start_url=url,
        max_pages=max_pages,
        check_links=check_links,
        max_link_checks=max_link_checks,
    )

    total_proposals = 0

    for page in results.get("pages", []):
        issues = page.get("seo_issues", [])

        proposals = generate_fix_proposals(
            page,
            issues,
        )

        page["fix_proposals"] = proposals
        total_proposals += len(proposals)

    results["fix_summary"] = {
        "total_proposals": total_proposals,
        "needs_review": sum(
            proposal["status"] == "needs_review"
            for page in results.get("pages", [])
            for proposal in page.get("fix_proposals", [])
        ),
        "manual_review": sum(
            proposal["status"] == "manual_review"
            for page in results.get("pages", [])
            for proposal in page.get("fix_proposals", [])
        ),
        "automatically_applicable": 0,
    }

    return results
