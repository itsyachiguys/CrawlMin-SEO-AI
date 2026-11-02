
from crawlmin.link_checker import classify_link


def test_classifies_internal_link():
    result = classify_link(
        "https://example.com/products",
        "/about",
    )

    assert result["url"] == "https://example.com/about"
    assert result["link_type"] == "internal"


def test_classifies_external_link():
    result = classify_link(
        "https://example.com/",
        "https://other.example/page",
    )

    assert result["link_type"] == "external"


def test_ignores_mailto_link():
    assert classify_link(
        "https://example.com/",
        "mailto:hello@example.com",
    ) is None