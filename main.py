
import argparse
import json
import sys

import httpx

from crawlmin.crawler import crawl_page, crawl_site
from crawlmin.seo_rules import analyze_seo


def summarize_issues(issues: list[dict]) -> dict:
    """Summarize SEO findings by severity."""
    return {
        "total_issues": len(issues),
        "errors": sum(
            issue["severity"] == "error" for issue in issues
        ),
        "warnings": sum(
            issue["severity"] == "warning" for issue in issues
        ),
        "info": sum(
            issue["severity"] == "info" for issue in issues
        ),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Crawl a website and analyze SEO issues and links."
    )

    parser.add_argument(
        "url",
        help="The HTTP or HTTPS URL to crawl",
    )

    parser.add_argument(
        "--max-pages",
        type=int,
        default=50,
        help="Maximum number of pages to crawl (default: 50)",
    )

    parser.add_argument(
        "--single-page",
        action="store_true",
        help="Analyze only the specified webpage",
    )

    parser.add_argument(
        "--check-links",
        action="store_true",
        help="Check internal and external links during a site crawl",
    )

    parser.add_argument(
        "--max-link-checks",
        type=int,
        default=100,
        help="Maximum unique link URLs to check (default: 100)",
    )

    args = parser.parse_args()

    if args.max_pages < 1:
        parser.error("--max-pages must be at least 1")

    if args.max_link_checks < 1:
        parser.error("--max-link-checks must be at least 1")

    try:
        if args.single_page:
            page = crawl_page(args.url)
            issues = analyze_seo(page)

            result = {
                **page,
                "seo_summary": summarize_issues(issues),
                "seo_issues": issues,
            }

            print(json.dumps(result, indent=2, ensure_ascii=False))

            if page["status_code"] >= 400:
                sys.exit(1)

        else:
            result = crawl_site(
                args.url,
                max_pages=args.max_pages,
                check_links=args.check_links,
                max_link_checks=args.max_link_checks,
            )

            print(json.dumps(result, indent=2, ensure_ascii=False))

            if result["crawl_errors"]:
                sys.exit(1)

    except (ValueError, httpx.HTTPError) as error:
        print(f"Crawl failed: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()