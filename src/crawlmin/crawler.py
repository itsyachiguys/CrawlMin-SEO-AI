
from collections import deque
from copy import deepcopy
import re
from urllib.parse import urldefrag, urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from crawlmin.link_checker import check_link, classify_link
from crawlmin.seo_rules import analyze_seo


USER_AGENT = "CrawlMinAI/0.1 (SEO auditing crawler)"
TIMEOUT = 15.0


def validate_url(url: str) -> str:
    """Validate that the target is an HTTP or HTTPS URL."""

    if not isinstance(url, str) or not url.strip():
        raise ValueError("URL must not be empty.")

    url = url.strip()
    parsed = urlsplit(url)

    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("URL must start with http:// or https://")

    if not parsed.hostname:
        raise ValueError("A valid hostname is required.")

    if parsed.username or parsed.password:
        raise ValueError(
            "URLs containing embedded credentials are not allowed."
        )

    try:
        parsed.port
    except ValueError as error:
        raise ValueError("URL contains an invalid port.") from error

    return url


def normalize_url(url: str) -> str:
    """Normalize URLs for duplicate detection."""

    url = urldefrag(url.strip())[0]
    parsed = urlsplit(url)

    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()

    if not hostname:
        raise ValueError("A valid hostname is required.")

    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError("URL contains an invalid port.") from error

    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"

    if port is not None:
        default_port = (
            (scheme == "http" and port == 80)
            or (scheme == "https" and port == 443)
        )

        netloc = hostname if default_port else f"{hostname}:{port}"
    else:
        netloc = hostname

    return urlunsplit(
        (
            scheme,
            netloc,
            parsed.path or "/",
            parsed.query,
            "",
        )
    )


def extract_content_text(soup: BeautifulSoup) -> str:
    """Extract readable page content while excluding non-content elements."""

    source = (
        soup.find("main")
        or soup.find("article")
        or soup.body
        or soup
    )

    content = deepcopy(source)

    for element in content.select(
        "script, style, noscript, nav, footer, header, "
        "aside, form, svg, iframe"
    ):
        element.decompose()

    text = content.get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()

    return text[:5000]


def crawl_page(url: str) -> dict:
    """Fetch one webpage and extract basic SEO information."""

    url = validate_url(url)

    with httpx.Client(
        timeout=TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        response = client.get(url)

    content_type = response.headers.get("content-type", "")

    if "html" in content_type.lower():
        soup = BeautifulSoup(response.text, "lxml")
    else:
        soup = BeautifulSoup("", "lxml")

    title_tag = soup.find("title")

    description_tag = soup.find(
        "meta",
        attrs={
            "name": lambda value: (
                value and value.lower() == "description"
            )
        },
    )

    canonical_tag = soup.find(
        "link",
        attrs={
            "rel": lambda value: (
                value
                and "canonical" in [
                    item.lower()
                    for item in (
                        value if isinstance(value, list) else [value]
                    )
                ]
            )
        },
    )

    headings = {
        f"h{level}": [
            heading.get_text(" ", strip=True)
            for heading in soup.find_all(f"h{level}")
        ]
        for level in range(1, 7)
    }

    content_text = extract_content_text(soup)

    links = [
        {
            "text": link.get_text(" ", strip=True),
            "href": link.get("href"),
        }
        for link in soup.find_all("a", href=True)
    ]

    images = [
        {
            "src": image.get("src"),
            "alt": image.get("alt"),
            "missing_alt": image.get("alt") is None,
        }
        for image in soup.find_all("img")
    ]

    return {
        "requested_url": url,
        "final_url": str(response.url),
        "status_code": response.status_code,
        "content_type": content_type,
        "title": title_tag.get_text(strip=True) if title_tag else None,
        "meta_description": (
            description_tag.get("content", "").strip()
            if description_tag
            else None
        ),
        "canonical": canonical_tag.get("href") if canonical_tag else None,
        "headings": headings,
        "content_text": content_text,
        "links": links,
        "images": images,
    }


def crawl_site(
    start_url: str,
    max_pages: int = 50,
    check_links: bool = False,
    max_link_checks: int = 100,
) -> dict:
    """Crawl internal HTML pages and analyze SEO and links."""

    start_url = normalize_url(validate_url(start_url))

    if max_pages < 1:
        raise ValueError("max_pages must be at least 1.")

    if max_link_checks < 1:
        raise ValueError("max_link_checks must be at least 1.")

    allowed_hostname = (urlsplit(start_url).hostname or "").lower()

    queue = deque([start_url])
    queued = {start_url}
    visited = set()
    results = []
    link_check_cache = {}

    while queue and len(visited) < max_pages:
        current_url = queue.popleft()

        if current_url in visited:
            continue

        visited.add(current_url)

        try:
            page = crawl_page(current_url)
            page["seo_issues"] = analyze_seo(page)
            page["crawl_error"] = None
            page["link_results"] = []

        except httpx.HTTPError as error:
            results.append(
                {
                    "requested_url": current_url,
                    "final_url": None,
                    "status_code": None,
                    "seo_issues": [],
                    "link_results": [],
                    "crawl_error": str(error),
                }
            )
            continue

        results.append(page)

        if check_links:
            for link in page.get("links", []):
                classified = classify_link(
                    page["final_url"],
                    link.get("href", ""),
                )

                if classified is None:
                    continue

                target_url = classified["url"]

                if target_url not in link_check_cache:
                    if len(link_check_cache) >= max_link_checks:
                        continue

                    link_check_cache[target_url] = check_link(target_url)

                page["link_results"].append(
                    {
                        **link_check_cache[target_url],
                        "source_url": page["final_url"],
                        "link_text": link.get("text", ""),
                        "link_type": classified["link_type"],
                    }
                )

        if (
            not page.get("content_type")
            or "html" not in page["content_type"].lower()
            or page["status_code"] >= 400
        ):
            continue

        base_url = page["final_url"]
        final_parts = urlsplit(base_url)

        if (final_parts.hostname or "").lower() != allowed_hostname:
            continue

        for link in page.get("links", []):
            href = link.get("href")

            if not href:
                continue

            absolute_url = urljoin(base_url, href)

            try:
                candidate = normalize_url(absolute_url)
                parsed = urlsplit(candidate)
            except ValueError:
                continue

            if parsed.scheme not in {"http", "https"}:
                continue

            if (parsed.hostname or "").lower() != allowed_hostname:
                continue

            if candidate not in queued and candidate not in visited:
                queued.add(candidate)
                queue.append(candidate)

    all_issues = [
        issue
        for page in results
        for issue in page.get("seo_issues", [])
    ]

    all_link_results = [
        link
        for page in results
        for link in page.get("link_results", [])
    ]

    broken_links = [
        link for link in all_link_results if link["is_broken"]
    ]

    link_summary = {
        "link_checking_enabled": check_links,
        "link_occurrences_checked": len(all_link_results),
        "unique_urls_checked": len(link_check_cache),
        "broken_links": len(broken_links),
        "broken_internal_links": sum(
            link["link_type"] == "internal"
            for link in broken_links
        ),
        "broken_external_links": sum(
            link["link_type"] == "external"
            for link in broken_links
        ),
    }

    return {
        "start_url": start_url,
        "max_pages": max_pages,
        "pages_crawled": len(visited),
        "pages_reported": len(results),
        "pages_remaining": len(queue),
        "crawl_limit_reached": bool(queue),
        "crawl_errors": sum(
            page.get("crawl_error") is not None
            for page in results
        ),
        "seo_summary": {
            "total_issues": len(all_issues),
            "errors": sum(
                issue["severity"] == "error"
                for issue in all_issues
            ),
            "warnings": sum(
                issue["severity"] == "warning"
                for issue in all_issues
            ),
            "info": sum(
                issue["severity"] == "info"
                for issue in all_issues
            ),
        },
        "link_summary": link_summary,
        "pages": results,
    }
