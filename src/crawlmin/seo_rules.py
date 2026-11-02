
def analyze_seo(page: dict) -> list[dict]:
    """Analyze extracted webpage data and return SEO issues."""

    issues = []

    def add_issue(
        rule_id: str,
        severity: str,
        message: str,
        recommendation: str,
    ) -> None:
        issues.append(
            {
                "rule_id": rule_id,
                "severity": severity,
                "message": message,
                "recommendation": recommendation,
            }
        )

    # 1. HTTP response status
    status_code = page.get("status_code")

    if isinstance(status_code, int) and status_code >= 400:
        add_issue(
            "HTTP_ERROR",
            "error",
            f"The page returned HTTP status {status_code}.",
            "Investigate the response and ensure the page returns the intended status.",
        )

    # 2. Page title
    title = page.get("title")

    if not isinstance(title, str) or not title.strip():
        add_issue(
            "TITLE_MISSING",
            "error",
            "The page has no title or its title is empty.",
            "Add a descriptive, unique HTML title.",
        )
    else:
        title_length = len(title.strip())

        if title_length < 30:
            add_issue(
                "TITLE_SHORT",
                "warning",
                f"The page title contains {title_length} characters.",
                "Consider making the title more descriptive. Length recommendations are guidelines, not strict ranking rules.",
            )
        elif title_length > 60:
            add_issue(
                "TITLE_LONG",
                "warning",
                f"The page title contains {title_length} characters.",
                "Consider shortening the title so it is less likely to be truncated in search results.",
            )

    # 3. Meta description
    description = page.get("meta_description")

    if not isinstance(description, str) or not description.strip():
        add_issue(
            "META_DESCRIPTION_MISSING",
            "warning",
            "The page has no meta description or its description is empty.",
            "Add a concise, relevant summary of the page.",
        )
    else:
        description_length = len(description.strip())

        if description_length < 80:
            add_issue(
                "META_DESCRIPTION_SHORT",
                "info",
                f"The meta description contains {description_length} characters.",
                "Consider adding useful detail that accurately summarizes the page.",
            )
        elif description_length > 160:
            add_issue(
                "META_DESCRIPTION_LONG",
                "info",
                f"The meta description contains {description_length} characters.",
                "Consider shortening the description. Search engines may display different snippets.",
            )

    # 4. H1 heading
    headings = page.get("headings") or {}
    h1_headings = headings.get("h1") or []

    if not h1_headings:
        add_issue(
            "H1_MISSING",
            "warning",
            "No H1 heading was found in the extracted HTML.",
            "Check whether the page needs a clear primary heading.",
        )
    elif len(h1_headings) > 1:
        add_issue(
            "H1_MULTIPLE",
            "info",
            f"The page contains {len(h1_headings)} H1 headings.",
            "Review the heading structure for clarity. Multiple H1 headings are not automatically an SEO error.",
        )

    # 5. Image alternative text
    images = page.get("images") or []

    for index, image in enumerate(images, start=1):
        if image.get("missing_alt", False):
            add_issue(
                "IMAGE_ALT_MISSING",
                "warning",
                f"Image {index} has no alt attribute.",
                "Add appropriate alt text to informative images. Use empty alt text for decorative images.",
            )

    # 6. Canonical URL
    canonical = page.get("canonical")

    if not isinstance(canonical, str) or not canonical.strip():
        add_issue(
            "CANONICAL_MISSING",
            "info",
            "No canonical URL was found in the extracted HTML.",
            "Check whether the page needs a canonical URL, especially if duplicate or similar URLs exist.",
        )

    return issues