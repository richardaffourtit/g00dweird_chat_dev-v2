"""Pytest fixtures + sys.path setup so tests can import backend modules."""
import os
import sys

# Ensure /app/backend is on sys.path for `import server`, `import weirdbot_brain`
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
