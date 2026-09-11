# Builds the backend described in docs/DEPLOYMENT.md: crawler/worker.py
# (FastAPI on Uvicorn), which also runs the crawl pipeline in
# crawler/main.py. This image does not include the frontend; that is a
# static build deployed separately (Vercel/Cloudflare/etc, see
# docs/DEPLOYMENT.md's "Frontend" section).
#
# Build from the repository root so the crawler/ package resolves:
#   docker build -t lilyblossom-backend .
# Run with a single worker, always (see docs/DEPLOYMENT.md and
# ARCHITECTURE.md's "Why a small Python backend instead of a Node
# one" for why more than one would be unsafe here):
#   docker run --env-file .env -p 8787:8787 lilyblossom-backend

FROM python:3.12-slim

WORKDIR /app

# libxml2/libxslt for lxml (crawler/sources/gl_archive.py's BeautifulSoup
# parser backend); no browser automation dependency is needed, no
# adapter currently uses Playwright.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libxml2-dev libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY crawler/requirements.txt ./crawler/requirements.txt
RUN pip install --no-cache-dir -r crawler/requirements.txt

COPY crawler ./crawler

ENV CRAWLER_WORKER_PORT=8787
EXPOSE 8787

# Always one worker: the crawl-in-progress lock in POST /run and the
# background crawl task both only work within a single process.
CMD ["uvicorn", "crawler.worker:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1"]
