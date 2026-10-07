import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# Dummy values so modules that validate configuration at import time can load without real keys.
# (Existing real environment variables are never overridden.)
os.environ.setdefault("PORTKEY_API_KEY", "test-portkey")
os.environ.setdefault("GROQ_SLUG", "test-slug-1")
os.environ.setdefault("GROQ_SLUG_2", "test-slug-2")
os.environ.setdefault("OPENAI_API_KEY", "test-openai")
os.environ["CHAT_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "chat_memory_test.db")  # never touch the real DB
