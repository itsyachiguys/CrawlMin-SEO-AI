
from crawlmin.fix_engine import generate_fix_proposals


def test_title_missing_uses_single_h1_as_candidate():
    page = {
        "final_url": "https://example.com/",
        "title": None,
        "headings": {"h1": ["Example Homepage"]},
    }

    issues = [
        {
            "rule_id": "TITLE_MISSING",
            "severity": "error",
            "message": "The page has no title.",
            "recommendation": "Add a descriptive title.",
        }
    ]

    proposals = generate_fix_proposals(page, issues)

    assert len(proposals) == 1
    assert proposals[0]["suggested_value"] == "Example Homepage"
    assert proposals[0]["status"] == "needs_review"
    assert proposals[0]["auto_applicable"] is False


def test_image_alt_requires_manual_review():
    page = {
        "final_url": "https://example.com/",
        "images": [
            {"src": "/images/banner.jpg", "alt": None}
        ],
    }

    issues = [
        {
            "rule_id": "IMAGE_ALT_MISSING",
            "severity": "warning",
            "message": "Image 1 has no alt attribute.",
            "recommendation": "Add appropriate alt text.",
        }
    ]

    proposals = generate_fix_proposals(page, issues)

    assert proposals[0]["original_value"] is None
    assert proposals[0]["suggested_value"] is None
    assert proposals[0]["status"] == "manual_review"


def test_canonical_missing_requires_manual_review():
    page = {
        "final_url": "https://example.com/page",
        "canonical": None,
    }

    issues = [
        {
            "rule_id": "CANONICAL_MISSING",
            "severity": "info",
            "message": "No canonical URL was found.",
            "recommendation": "Review canonical configuration.",
        }
    ]

    proposals = generate_fix_proposals(page, issues)

    assert proposals[0]["status"] == "manual_review"
    assert proposals[0]["auto_applicable"] is False


def test_empty_issues_return_empty_proposals():
    page = {"final_url": "https://example.com/"}

    assert generate_fix_proposals(page, []) == []
