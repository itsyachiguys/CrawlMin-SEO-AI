
"""Generate safe, reviewable SEO fix proposals.

This module does not modify website files or remote websites.
"""

import hashlib
import html
import re


def _get_original_value(page: dict, rule_id: str, issue: dict):
    """Retrieve the existing value associated with an SEO issue."""

    if rule_id in {"TITLE_MISSING", "TITLE_SHORT", "TITLE_LONG"}:
        return page.get("title")

    if rule_id in {
        "META_DESCRIPTION_MISSING",
        "META_DESCRIPTION_SHORT",
        "META_DESCRIPTION_LONG",
    }:
        return page.get("meta_description")

    if rule_id in {"H1_MISSING", "H1_MULTIPLE"}:
        return (page.get("headings") or {}).get("h1", [])

    if rule_id == "CANONICAL_MISSING":
        return page.get("canonical")

    if rule_id == "IMAGE_ALT_MISSING":
        match = re.search(r"Image (\d+)", issue.get("message", ""))

        if match:
            index = int(match.group(1)) - 1
            images = page.get("images") or []

            if 0 <= index < len(images):
                return images[index].get("alt")

    if rule_id == "HTTP_ERROR":
        return page.get("status_code")

    return None


def _single_h1_candidate(page: dict):
    """Return a valid candidate if exactly one usable H1 exists."""

    headings = (page.get("headings") or {}).get("h1", [])

    if not isinstance(headings, list) or len(headings) != 1:
        return None

    heading = headings[0]

    if not isinstance(heading, str):
        return None

    heading = heading.strip()

    if not heading:
        return None

    return heading


def _shorten_title(title: str, max_length: int = 60):
    """Shorten a title at a word boundary without inventing wording."""

    title = title.strip()

    if len(title) <= max_length:
        return None

    shortened = title[:max_length].rsplit(" ", 1)[0].strip()

    if len(shortened) < 20:
        return None

    return shortened


def _clean_heading_candidate(value: str, max_length: int = 70):
    """Clean and shorten a heading candidate without inventing wording."""

    if not isinstance(value, str):
        return None

    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    value = value.strip(" -|:;,.")
    
    if len(value) < 10:
        return None

    if len(value) > max_length:
        shortened = value[:max_length].rsplit(" ", 1)[0].strip()

        if len(shortened) < 10:
            return None

        value = shortened

    return value


def _generate_h1_candidate(page: dict):
    """Generate an H1 candidate from existing page content."""

    # First choice: use the existing SEO title.
    title = page.get("title")

    candidate = _clean_heading_candidate(title)

    if candidate:
        return candidate, "page title"

    # Second choice: use the meta description.
    description = page.get("meta_description")

    if isinstance(description, str) and description.strip():
        sentences = re.split(
            r"(?<=[.!?])\s+",
            description.strip(),
        )

        for sentence in sentences:
            candidate = _clean_heading_candidate(sentence)

            if candidate:
                return candidate, "meta description"

        candidate = _clean_heading_candidate(description)

        if candidate:
            return candidate, "meta description"

    # Third choice: use the extracted main page content.
    content = page.get("content_text")

    if isinstance(content, str) and content.strip():
        content = re.sub(r"\s+", " ", content).strip()

        sentences = re.split(
            r"(?<=[.!?])\s+",
            content,
        )

        for sentence in sentences:
            candidate = _clean_heading_candidate(sentence)

            if candidate:
                return candidate, "extracted page content"

        candidate = _clean_heading_candidate(content)

        if candidate:
            return candidate, "extracted page content"

    return None, None


def _generate_meta_description(page: dict):
    """Create a description candidate using extracted page content."""

    text = page.get("content_text")

    if not isinstance(text, str):
        return None

    text = re.sub(r"\s+", " ", text).strip()

    if len(text) < 80:
        return None

    sentences = re.split(r"(?<=[.!?])\s+", text)

    description = ""

    for sentence in sentences:
        sentence = sentence.strip()

        if not sentence:
            continue

        candidate = (
            f"{description} {sentence}".strip()
            if description
            else sentence
        )

        if len(candidate) <= 160:
            description = candidate
        else:
            continue

    if len(description) >= 80:
        return description

    shortened = text[:157].rsplit(" ", 1)[0].strip()

    if len(shortened) >= 80:
        return shortened + "..."

    return None


def _shorten_description(description: str, max_length: int = 160):
    """Shorten an existing description without splitting a word."""

    description = description.strip()

    if len(description) <= max_length:
        return None

    shortened = description[:max_length].rsplit(" ", 1)[0].strip()

    if len(shortened) < 80:
        return None

    return shortened


def _suggest_fix(page: dict, rule_id: str):
    """Return a conservative suggestion and its risk level."""

    if rule_id == "TITLE_MISSING":
        candidate = _single_h1_candidate(page)

        if candidate:
            return {
                "suggested_value": candidate,
                "risk": "medium",
                "reason": (
                    "The single H1 heading can be reviewed as a "
                    "candidate page title."
                ),
            }

        return {
            "suggested_value": None,
            "risk": "high",
            "reason": "There is no single reliable heading to use as a title.",
        }

    if rule_id == "TITLE_SHORT":
        candidate = _single_h1_candidate(page)

        if candidate and 30 <= len(candidate) <= 60:
            return {
                "suggested_value": candidate,
                "risk": "medium",
                "reason": (
                    "A single H1 heading provides a more descriptive "
                    "title candidate. Verify that it accurately represents "
                    "the page before approving."
                ),
            }

        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": (
                "A longer title needs content review. No suitable "
                "replacement could be safely derived from the H1."
            ),
        }

    if rule_id == "TITLE_LONG":
        title = page.get("title")

        if isinstance(title, str):
            candidate = _shorten_title(title)

            if candidate:
                return {
                    "suggested_value": candidate,
                    "risk": "medium",
                    "reason": (
                        "The existing title was shortened at a word "
                        "boundary. Review it to ensure important context "
                        "has not been removed."
                    ),
                }

        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": (
                "The title needs manual editing because a safe shorter "
                "version could not be generated."
            ),
        }

    if rule_id in {
        "META_DESCRIPTION_MISSING",
        "META_DESCRIPTION_SHORT",
    }:
        candidate = _generate_meta_description(page)

        if candidate:
            return {
                "suggested_value": candidate,
                "risk": "medium",
                "reason": (
                    "A description candidate was generated from extracted "
                    "page content. Review it for accuracy and relevance."
                ),
            }

        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": (
                "Insufficient readable page content was available to "
                "generate a reliable description."
            ),
        }

    if rule_id == "META_DESCRIPTION_LONG":
        description = page.get("meta_description")

        if isinstance(description, str):
            candidate = _shorten_description(description)

            if candidate:
                return {
                    "suggested_value": candidate,
                    "risk": "medium",
                    "reason": (
                        "The existing description was shortened at a word "
                        "boundary. Review it to ensure important context "
                        "has not been removed."
                    ),
                }

        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": "A safe shorter description could not be generated.",
        }

    if rule_id == "H1_MISSING":
        candidate, source = _generate_h1_candidate(page)

        if candidate:
            return {
                "suggested_value": candidate,
                "risk": "medium",
                "reason": (
                    f"A heading candidate was derived from the {source}. "
                    "Review it to ensure it accurately describes the "
                    "page's main topic before approval."
                ),
            }

        return {
            "suggested_value": None,
            "risk": "high",
            "reason": (
                "No reliable heading candidate could be derived from "
                "the page title, meta description, or extracted content."
            ),
        }

    if rule_id == "H1_MULTIPLE":
        return {
            "suggested_value": None,
            "risk": "high",
            "reason": (
                "The correct heading structure depends on the page's "
                "content and layout."
            ),
        }

    if rule_id == "IMAGE_ALT_MISSING":
        return {
            "suggested_value": None,
            "risk": "high",
            "reason": (
                "The image must be inspected to determine whether it is "
                "informative or decorative."
            ),
        }

    if rule_id == "CANONICAL_MISSING":
        return {
            "suggested_value": None,
            "risk": "high",
            "reason": (
                "A canonical URL requires duplicate-page and URL "
                "structure review."
            ),
        }

    if rule_id == "HTTP_ERROR":
        return {
            "suggested_value": None,
            "risk": "high",
            "reason": "The HTTP response must be investigated manually.",
        }

    return {
        "suggested_value": None,
        "risk": "high",
        "reason": "No safe automated correction is available for this rule.",
    }


def generate_fix_proposals(
    page: dict,
    issues: list[dict] | None = None,
):
    """Generate reviewable fix proposals for a crawled page."""

    if issues is None:
        issues = page.get("seo_issues") or page.get("issues") or []

    page_url = (
        page.get("final_url")
        or page.get("url")
        or page.get("requested_url")
        or ""
    )

    proposals = []

    for index, issue in enumerate(issues, start=1):
        rule_id = issue.get("rule_id", "UNKNOWN")
        suggestion = _suggest_fix(page, rule_id)

        original_value = _get_original_value(
            page,
            rule_id,
            issue,
        )

        identity = f"{page_url}:{rule_id}:{index}"

        proposal_id = hashlib.sha256(
            identity.encode("utf-8")
        ).hexdigest()[:16]

        suggested_value = suggestion["suggested_value"]

        proposals.append({
            "proposal_id": proposal_id,
            "page_url": page_url,
            "rule_id": rule_id,
            "severity": issue.get("severity"),
            "message": issue.get("message"),
            "recommendation": issue.get("recommendation"),
            "original_value": original_value,
            "suggested_value": suggested_value,
            "risk": suggestion["risk"],
            "reason": suggestion["reason"],
            "status": (
                "needs_review"
                if suggested_value is not None
                else "manual_review"
            ),
            "auto_applicable": False,
        })

    return proposals
