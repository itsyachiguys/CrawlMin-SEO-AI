
from pydantic import BaseModel, Field, HttpUrl


class AuditRequest(BaseModel):
    url: HttpUrl

    max_pages: int = Field(default=10, ge=1, le=100)

    check_links: bool = False

    max_link_checks: int = Field(default=100, ge=1, le=500)

    single_page: bool = False


class HealthResponse(BaseModel):
    status: str
    application: str
    version: str


class AuditResponse(BaseModel):
    status: str
    audit_type: str
    target_url: str
    results: dict
