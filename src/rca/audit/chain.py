import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

GENESIS_HASH = "0" * 64
_STATE_DIR = os.getenv("RCA_STATE_DIR")
DEFAULT_AUDIT_LOG_PATH = (
    Path(_STATE_DIR) if _STATE_DIR else Path(__file__).resolve().parents[3] / "incidents"
) / "audit_chain.jsonl"


def ensure_audit_directory(file_path: Path) -> Path:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if not file_path.exists():
        file_path.touch()
    return file_path


def get_latest_hash(file_path: Path) -> str:
    ensure_audit_directory(file_path)
    raw_content = file_path.read_text(encoding="utf-8").strip()
    if not raw_content:
        return GENESIS_HASH
    last_line = raw_content.splitlines()[-1]
    parsed_record = json.loads(last_line)
    return str(parsed_record.get("hash", GENESIS_HASH))


def compute_entry_hash(prev_hash: str, timestamp_iso: str, event_type: str, payload_json: str) -> str:
    hasher = hashlib.sha256()
    hasher.update(prev_hash.encode("utf-8"))
    hasher.update(timestamp_iso.encode("utf-8"))
    hasher.update(event_type.encode("utf-8"))
    hasher.update(payload_json.encode("utf-8"))
    return hasher.hexdigest()


def append_audit_event(
    event_type: str,
    payload: dict[str, Any],
    file_path: Path = DEFAULT_AUDIT_LOG_PATH,
) -> str:
    ensure_audit_directory(file_path)
    prev_hash = get_latest_hash(file_path)
    timestamp_iso = datetime.now(UTC).isoformat()
    payload_json = json.dumps(payload, sort_keys=True)
    entry_hash = compute_entry_hash(prev_hash, timestamp_iso, event_type, payload_json)

    log_entry = {
        "timestamp": timestamp_iso,
        "event_type": event_type,
        "payload": payload,
        "prev_hash": prev_hash,
        "hash": entry_hash,
    }

    with file_path.open(mode="a", encoding="utf-8") as audit_file:
        audit_file.write(json.dumps(log_entry, sort_keys=True) + "\n")

    return entry_hash