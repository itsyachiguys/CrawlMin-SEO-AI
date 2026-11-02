
from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool
import httpx

from backend.app.schemas.audit import (
    AuditRequest,
    AuditResponse,
    HealthResponse,
)
from backend.app.services.audit_service import run_audit


router = APIRouter(prefix="/api/v1", tags=["CrawlMin API"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        application="CrawlMin SEO AI",
        version="0.1.0",
    )


@router.post("/audits", response_model=AuditResponse)
async def create_audit(request: AuditRequest):

    target_url = str(request.url)

    try:
        results = await run_in_threadpool(
            run_audit,
            url=target_url,
            max_pages=request.max_pages,
            check_links=request.check_links,
            max_link_checks=request.max_link_checks,
            single_page=request.single_page,
        )

        return AuditResponse(
            status="completed",
            audit_type=(
                "single_page"
                if request.single_page
                else "website"
            ),
            target_url=target_url,
            results=results,
        )

    except (ValueError, httpx.HTTPError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="The audit could not be completed.",
        ) from error
