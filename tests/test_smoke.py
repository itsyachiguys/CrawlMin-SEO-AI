
import pytest

from crawlmin.crawler import validate_url
from crawlmin.seo_rules import analyze_seo


def test_accepts_https_url():
    assert validate_url("https://example.com") == "https://example.com"


def test_accepts_http_url():
    assert validate_url("http://example.com") == "http://example.com"


@pytest.mark.parametrize(
    "url",
    ["ftp://example.com", "example.com", ""],
)
def test_rejects_invalid_url(url):
    with pytest.raises(ValueError):
        validate_url(url)


def test_rejects_embedded_credentials():
    with pytest.raises(ValueError):
        validate_url("https://user:password@example.com")


def test_detects_missing_seo_fields():
    page = {
        "status_code": 200,
        "title": None,
        "meta_description": None,
        "canonical": None,
        "headings": {"h1": []},
        "images": [],
    }

    rule_ids = {
        issue["rule_id"] for issue in analyze_seo(page)
    }

    assert "TITLE_MISSING" in rule_ids
    assert "META_DESCRIPTION_MISSING" in rule_ids
    assert "H1_MISSING" in rule_ids
    assert "CANONICAL_MISSING" in rule_ids


def test_detects_image_without_alt_attribute():
    page = {
        "status_code": 200,
        "title": "A descriptive page title for testing",
        "meta_description": "A useful description for this test page.",
        "canonical": "https://example.com/",
        "headings": {"h1": ["Test heading"]},
        "images": [
            {"src": "/image.jpg", "missing_alt": True}
        ],
    }

    issues = analyze_seo(page)

    assert any(
        issue["rule_id"] == "IMAGE_ALT_MISSING"
        for issue in issues
    )


def test_clean_page_has_no_issues():
    page = {
        "status_code": 200,
        "title": "A descriptive title for this example page",
        "meta_description": (
            "This is a sufficiently detailed description of the example page "
            "for our basic SEO test."
        ),
        "canonical": "https://example.com/",
        "headings": {"h1": ["Example page"]},
        "images": [
            {"src": "/image.jpg", "alt": "Example image", "missing_alt": False}
        ],
    }

    assert analyze_seo(page) == []