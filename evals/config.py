"""Shared settings for the eval suite."""
import os

# The running FastAPI /query endpoint the evals call. Override with EVAL_API_URL.
API_URL = os.getenv("EVAL_API_URL", "http://localhost:8000/query")
