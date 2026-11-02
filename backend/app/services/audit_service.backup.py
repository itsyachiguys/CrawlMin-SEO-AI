
from crawlmin.crawler import crawl_page, crawl_site
from crawlmin.seo_rules import analyze_seo


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

        return {
            "target_url": url,
            "pages_crawled": 1,
            "pages": [
                {
                    "url": page.get("url", url),
                    "status_code": page.get("status_code"),
                    "issues": issues,
                    "issue_count": len(issues),
                }
            ],
            "summary": {
                "total_pages": 1,
                "total_issues": len(issues),
            },
        }

    return crawl_site(
        start_url=url,
        max_pages=max_pages,
        check_links=check_links,
        max_link_checks=max_link_checks,
    )
