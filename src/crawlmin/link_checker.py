
from urllib.parse import urljoin, urlsplit

import httpx


USER_AGENT = "CrawlMinAI/0.2 (SEO auditing crawler)"
TIMEOUT = 15.0

# Only these responses are treated as confirmed broken destinations.
CONFIRMED_BROKEN_STATUSES = {404, 410}


def validate_link_url(url: str) -> str:
    """Validate a URL before requesting it."""
    if not isinstance(url, str) or not url.strip():
        raise ValueError("URL must not be empty.")

    url = url.strip()
    parsed = urlsplit(url)

    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("URL must use HTTP or HTTPS.")

    if not parsed.hostname:
        raise ValueError("A valid hostname is required.")

    if parsed.username or parsed.password:
        raise ValueError(
            "URLs containing embedded credentials are not allowed."
        )

    try:
        parsed.port
    except ValueError as error:
        raise ValueError(
            "URL contains an invalid port."
        ) from error

    return url


def classify_status(status_code: int) -> str:
    """Classify an HTTP response without assuming every error is broken."""

    if 200 <= status_code < 300:
        return "working"

    if status_code in CONFIRMED_BROKEN_STATUSES:
        return "broken"

    if 300 <= status_code < 400:
        return "redirected"

    if status_code == 429:
        return "rate_limited"

    if status_code in {401, 403, 405}:
        return "unverified"

    if 500 <= status_code < 600:
        return "server_error"

    return "unverified"


def check_link(url: str) -> dict:
    """Check a URL and return its verification status."""

    try:
        url = validate_link_url(url)

    except ValueError as error:
        return {
            "url": url,
            "status_code": None,
            "final_url": None,
            "is_broken": True,
            "link_status": "invalid",
            "error": str(error),
        }

    try:
        with httpx.Client(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = client.get(url)

        link_status = classify_status(response.status_code)

        return {
            "url": url,
            "status_code": response.status_code,
            "final_url": str(response.url),
            "is_broken": link_status == "broken",
            "link_status": link_status,
            "error": None,
        }

    except httpx.HTTPError as error:
        return {
            "url": url,
            "status_code": None,
            "final_url": None,
            "is_broken": False,
            "link_status": "unverified",
            "error": str(error),
        }


def classify_link(source_url: str, href: str) -> dict | None:
    """Resolve a link and classify it as internal or external."""

    if not href:
        return None

    href = href.strip()

    if not href or href.startswith("#"):
        return None

    if href.lower().startswith(
        ("mailto:", "tel:", "javascript:", "data:")
    ):
        return None

    absolute_url = urljoin(source_url, href)
    parsed = urlsplit(absolute_url)

    if parsed.scheme.lower() not in {"http", "https"}:
        return None

    if not parsed.hostname:
        return None

    source_host = (
        urlsplit(source_url).hostname or ""
    ).lower()

    target_host = parsed.hostname.lower()

    return {
        "url": absolute_url,
        "link_type": (
            "internal" if target_host == source_host else "external"
        ),
    }
