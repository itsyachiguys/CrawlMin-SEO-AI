
"""Generate safe, reviewable SEO fix proposals.

This module does not modify website files or remote websites.
"""

import hashlib
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


def _suggest_fix(page: dict, rule_id: str):
    """Return a conservative suggestion and its risk level."""

    if rule_id == "TITLE_MISSING":
        headings = (page.get("headings") or {}).get("h1", [])

        if len(headings) == 1 and headings[0].strip():
            return {
                "suggested_value": headings[0].strip(),
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

    if rule_id in {"TITLE_SHORT", "TITLE_LONG"}:
        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": (
                "The title needs content review. Automatically changing "
                "its wording could alter its meaning."
            ),
        }

    if rule_id.startswith("META_DESCRIPTION_"):
        return {
            "suggested_value": None,
            "risk": "medium",
            "reason": (
                "A relevant description must be written using the "
                "actual page content."
            ),
        }

    if rule_id in {"H1_MISSING", "H1_MULTIPLE"}:
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


def generate_fix_proposals(page: dict, issues: list[dict] | None = None):
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
