
from crawlmin import crawler


def make_page(url, links=None, status_code=200):
    return {
        "requested_url": url,
        "final_url": url,
        "status_code": status_code,
        "content_type": "text/html; charset=utf-8",
        "title": "A descriptive example page title",
        "meta_description": (
            "A sufficiently detailed example description for testing "
            "the multi-page crawler correctly."
        ),
        "canonical": url,
        "headings": {"h1": ["Example page"]},
        "links": links or [],
        "images": [],
    }


def test_crawl_site_discovers_internal_pages(monkeypatch):
    start = "https://example.com/"
    about = "https://example.com/about"

    pages = {
        start: make_page(
            start,
            [
                {"text": "About", "href": "/about"},
                {"text": "External", "href": "https://other.example/page"},
                {"text": "Duplicate", "href": "/about#team"},
            ],
        ),
        about: make_page(about),
    }

    def fake_crawl_page(url):
        return pages[url]

    monkeypatch.setattr(crawler, "crawl_page", fake_crawl_page)

    result = crawler.crawl_site(start, max_pages=10)

    assert result["pages_crawled"] == 2
    assert result["pages_reported"] == 2
    assert result["crawl_errors"] == 0

    crawled_urls = {
        page["requested_url"] for page in result["pages"]
    }

    assert crawled_urls == {start, about}


def test_crawl_site_respects_max_pages(monkeypatch):
    start = "https://example.com/"

    def fake_crawl_page(url):
        return make_page(
            url,
            [{"text": "Next", "href": "/next"}],
        )

    monkeypatch.setattr(crawler, "crawl_page", fake_crawl_page)

    result = crawler.crawl_site(start, max_pages=1)

    assert result["pages_crawled"] == 1
    assert result["crawl_limit_reached"] is True
    assert result["pages_remaining"] == 1