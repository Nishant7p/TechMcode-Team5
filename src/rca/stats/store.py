import json
import os
import threading
from pathlib import Path

_STATE_DIR = os.getenv("RCA_STATE_DIR")
USAGE_STATS_PATH = (
    Path(_STATE_DIR) if _STATE_DIR else Path(__file__).resolve().parents[3] / "incidents"
) / "usage_stats.json"
_WRITE_LOCK = threading.Lock()
_EMPTY_STATS = {"incidents_analyzed": 0, "nodes_analyzed": 0}


def _load_raw(file_path: Path) -> dict[str, int]:
    if not file_path.exists():
        return dict(_EMPTY_STATS)
    try:
        stored = json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return dict(_EMPTY_STATS)
    return {
        "incidents_analyzed": int(stored.get("incidents_analyzed", 0)),
        "nodes_analyzed": int(stored.get("nodes_analyzed", 0)),
    }


def read_usage_stats(file_path: Path = USAGE_STATS_PATH) -> dict[str, int]:
    with _WRITE_LOCK:
        return _load_raw(file_path)


def record_analysis(node_count: int, file_path: Path = USAGE_STATS_PATH) -> dict[str, int]:
    with _WRITE_LOCK:
        stats = _load_raw(file_path)
        stats["incidents_analyzed"] += 1
        stats["nodes_analyzed"] += max(node_count, 0)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(stats), encoding="utf-8")
        return stats
