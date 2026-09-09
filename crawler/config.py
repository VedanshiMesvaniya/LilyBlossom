"""Crawler configuration, loaded from environment variables.

Never hard-code the current year here (see product spec section 87);
use CURRENT_YEAR everywhere a "now" is needed so future releases
automatically classify as upcoming next year without a code change.
"""
import os
from datetime import date

from dotenv import load_dotenv

load_dotenv()

# Frontend and backend read the same .env file at the repo root, so
# this uses the same key the Vite frontend uses (VITE_SUPABASE_URL).
# Vite only ever exposes VITE_ prefixed keys to browser code, so
# sharing this one file never leaks SUPABASE_SERVICE_ROLE_KEY to the
# browser, it simply is not a VITE_ prefixed key.
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
CRAWLER_SECRET = os.environ.get("CRAWLER_SECRET", "")
CRAWLER_WORKER_PORT = int(os.environ.get("CRAWLER_WORKER_PORT", "8787"))

CURRENT_YEAR = date.today().year

REQUEST_TIMEOUT_SECONDS = 20
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2
REQUEST_DELAY_SECONDS = 1.5  # politeness delay between requests to one source

DUPLICATE_CONFIDENCE_THRESHOLD = 0.95   # >= this: treat as the same title
REVIEW_CONFIDENCE_THRESHOLD = 0.80      # 0.80-0.95: needs admin review
# below REVIEW_CONFIDENCE_THRESHOLD: treated as a different title

USER_AGENT = "LilyBlossomCrawler/1.0 (+mailto:vedanshimesvaniya@gmail.com)"
