# Python 3.13, not 3.14: unstructured 0.27.x (used by the Office loader) declares Requires-Python <3.14.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 CHAT_DB_PATH=/data/chat_memory.db
WORKDIR /srv

COPY requirements.api.txt .
RUN pip install -r requirements.api.txt

COPY app ./app

# non-root user; /data holds the SQLite memory, /tmp/flashrank the reranker model (both are volumes in compose)
RUN useradd --create-home app && mkdir -p /data /tmp/flashrank && chown -R app /data /tmp/flashrank /srv
USER app

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/docs')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
