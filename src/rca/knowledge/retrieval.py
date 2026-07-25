import json
import os
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

from rca.agents.client import get_openai_client

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNBOOKS_PATH = REPO_ROOT / "knowledge" / "runbooks" / "runbooks.json"
PAST_INCIDENTS_PATH = REPO_ROOT / "knowledge" / "incidents" / "past_incidents.json"
_STATE_DIR = os.getenv("RCA_STATE_DIR")
CHROMA_DIR = (Path(_STATE_DIR) / "chroma") if _STATE_DIR else (REPO_ROOT / "knowledge" / ".chroma")

EMBED_MODEL = "text-embedding-3-small"
RUNBOOK_COLLECTION = "noc_runbooks"
INCIDENT_COLLECTION = "past_incidents"


def _load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_runbooks() -> list[dict[str, Any]]:
    return _load_json(RUNBOOKS_PATH)


@lru_cache(maxsize=1)
def load_past_incidents() -> list[dict[str, Any]]:
    return _load_json(PAST_INCIDENTS_PATH)


def _runbook_document(entry: dict[str, Any]) -> str:
    parts = [
        entry.get("title", ""),
        " ".join(entry.get("applies_to", [])),
        " ".join(entry.get("diagnostic_steps", [])),
        " ".join(entry.get("remediation", [])),
    ]
    return " ".join(part for part in parts if part)


def _incident_document(entry: dict[str, Any]) -> str:
    parts = [
        entry.get("title", ""),
        entry.get("fault_type", ""),
        entry.get("symptom", ""),
        entry.get("summary", ""),
        entry.get("resolution", ""),
    ]
    return " ".join(part for part in parts if part)


def _runbook_metadata(entry: dict[str, Any]) -> dict[str, Any]:
    return {"title": entry.get("title", entry.get("id", "")), "applies_to": ", ".join(entry.get("applies_to", []))}


def _incident_metadata(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": entry.get("title", entry.get("id", "")),
        "root_cause": entry.get("root_cause", ""),
        "fault_type": entry.get("fault_type", ""),
        "impact_path": entry.get("impact_path", ""),
    }


def _embed(texts: list[str]) -> list[list[float]]:
    response = get_openai_client().embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in response.data]


def _get_chroma_client() -> Any:
    import chromadb
    from chromadb.config import Settings

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(CHROMA_DIR), settings=Settings(anonymized_telemetry=False))


def _ensure_collection(
    name: str,
    entries: list[dict[str, Any]],
    document_of: Callable[[dict[str, Any]], str],
    metadata_of: Callable[[dict[str, Any]], dict[str, Any]],
) -> Any:
    collection = _get_chroma_client().get_or_create_collection(name, metadata={"hnsw:space": "cosine"})
    if not entries:
        return collection
    if collection.count() >= len(entries):
        return collection
    documents = [document_of(entry) for entry in entries]
    collection.upsert(
        ids=[entry["id"] for entry in entries],
        embeddings=_embed(documents),
        documents=documents,
        metadatas=[metadata_of(entry) for entry in entries],
    )
    return collection


def _format_matches(result: dict[str, Any]) -> list[dict[str, Any]]:
    ids = result.get("ids", [[]])[0]
    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    distances = result.get("distances", [[]])[0]
    matches: list[dict[str, Any]] = []
    paired = zip(ids, documents, metadatas, distances, strict=False)
    for entry_id, document, metadata, distance in paired:
        meta = metadata or {}
        matches.append(
            {
                "id": entry_id,
                "title": meta.get("title", entry_id),
                "snippet": (document or "")[:400],
                "score": round(1.0 - float(distance), 4),
            }
        )
    return matches


def _query(
    name: str,
    entries: list[dict[str, Any]],
    document_of: Callable[[dict[str, Any]], str],
    metadata_of: Callable[[dict[str, Any]], dict[str, Any]],
    text: str,
    k: int,
) -> list[dict[str, Any]]:
    collection = _ensure_collection(name, entries, document_of, metadata_of)
    if collection.count() == 0:
        return []
    query_embedding = _embed([text])[0]
    result = collection.query(query_embeddings=[query_embedding], n_results=min(k, collection.count()))
    return _format_matches(result)


def build_index() -> dict[str, int]:
    runbooks = _ensure_collection(RUNBOOK_COLLECTION, load_runbooks(), _runbook_document, _runbook_metadata)
    incidents = _ensure_collection(INCIDENT_COLLECTION, load_past_incidents(), _incident_document, _incident_metadata)
    return {"runbooks": runbooks.count(), "past_incidents": incidents.count()}


def retrieve_runbooks(query: str, k: int = 3) -> list[dict[str, Any]]:
    try:
        return _query(RUNBOOK_COLLECTION, load_runbooks(), _runbook_document, _runbook_metadata, query, k)
    except Exception:
        return []


def retrieve_similar_incidents(description: str, k: int = 2) -> list[dict[str, Any]]:
    try:
        return _query(
            INCIDENT_COLLECTION, load_past_incidents(), _incident_document, _incident_metadata, description, k
        )
    except Exception:
        return []
