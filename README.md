# Network Anomaly Root-Cause Assistant

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/UI-Next.js%2015-000000?logo=next.js&logoColor=white)
![Tests](https://img.shields.io/badge/tests-300%2B%20passing-2ea44f)
![Determinism](https://img.shields.io/badge/ranking-deterministic-red)
[![Live Demo](https://img.shields.io/badge/Live_Demo-CausalOps-E50914?logo=vercel&logoColor=white)](https://tech-mcode-team5.vercel.app/)

Ingests network telemetry, logs, alerts, topology, and configuration changes; detects anomalies across time windows; and produces **ranked, evidence-backed root-cause hypotheses**, distinguishing genuine **causation from mere correlation** by constraining inference to the physical network topology.

Upload an incident (or your own dataset) and the system tells you **which component is the root cause**, **why** (with a three-tier evidence ledger), **how the fault propagated**, and **what to do next**, backed by a tamper-evident audit trail.

> [!TIP]
> **Live demo: [tech-mcode-team5.vercel.app](https://tech-mcode-team5.vercel.app/)**
> The hosted app walks the full worked reference incident (`INC-1001`, a database connection-pool exhaustion cascading to the web tier): the topology graph, the ranked hypotheses, the three-tier evidence ledger, the propagation timeline, the agentic-RAG remediation, and the verifiable audit trail. Every panel is served from the **real engine's output**, so the link is always live with no setup. Running the project locally (see [Running locally](#running-locally)) additionally unlocks live analysis of your own uploaded incidents.

> [!NOTE]
> **Looking for more depth?** Two companion documents ship with this repository:
> - **[`summary.pdf`](summary.pdf)** - the executive summary: the problem, the solution, the design rationale (what we chose and what we chose against), a live walkthrough of the running product, results, and the per-member contribution breakdown.
> - **[`explanation.pdf`](explanation.pdf)** - the full technical deep dive: a chapter per layer covering how each part works from first principles, its implementation and files, what is novel about it, and its future scope.
>
> For **project details and individual contributions**, please refer to these two documents.

---

## Table of contents

1. [The problem](#the-problem)
2. [What makes it different](#what-makes-it-different)
3. [Key features](#key-features)
4. [Architecture](#architecture)
5. [System layers](#system-layers)
6. [How it works](#how-it-works)
7. [Tech stack](#tech-stack)
8. [Repository structure](#repository-structure)
9. [Running locally](#running-locally)
10. [Using the application](#using-the-application)
11. [Input data format](#input-data-format)
12. [API reference](#api-reference)
13. [Testing](#testing)
14. [Evaluation and accuracy](#evaluation-and-accuracy)
15. [Design decisions and FAQ](#design-decisions-and-faq)
16. [Known limitations and roadmap](#known-limitations-and-roadmap)
17. [Licence](#licence)

---

## The problem

A network operations centre receives **thousands of alerts an hour**. Most are *symptoms*, not causes. Engineers spend the majority of mean-time-to-resolution simply deciding *which* signal is the culprit and which are downstream noise.

Tools that correlate events by timestamp routinely **blame whichever component moved first**, which is frequently the *victim* rather than the cause. A database that saturates its connection pool will make the web tier look broken, and a naive tool blames the web tier. The engineer needs the *cause*: the database, several hops upstream.

## What makes it different

**We separate causation from correlation using the network topology itself.** A component can only be proposed as a root cause if a **real dependency path exists** from it to the symptomatic component. Everything else, no matter how anomalous or how recently it changed, is demoted, and the *reason* it was demoted is shown to the user.

The system is deliberately split into two layers:

- **A deterministic core** that decides the root cause. Robust baselines and change-point detection find the *onset* of each anomaly; topology-constrained candidate filtering, causal attribution, and counterfactual analysis rank the causes. **The same incident always produces the same ranking.** It is reproducible and explainable, not a black box.
- **A bounded reasoning (LLM) layer** that only does what language models are good at: writing the incident timeline, explaining findings in plain English, **adversarially reviewing** each hypothesis, and recommending diagnostic steps. **The LLM never selects the root cause**, and its influence on confidence is clamped so it can never override the deterministic ranking.

This is the **"vending machine over slot machine"** principle: determinism where correctness matters, AI where language matters.

## Key features

- **Topology-constrained causal ranking (the moat).** Impact paths, blast-radius, and DoWhy attribution computed over the real dependency graph.
- **Three-tier evidence ledger.** Every hypothesis separates **confirmed evidence** (cited to a raw record), **correlated signals**, and **missing evidence**, and the missing evidence *is* the recommended next-steps list.
- **Counterfactual replay.** For example, "removing config change CHG-4212 restores web-02 to baseline."
- **Bounded, agentic AI.** A skeptic (adversarial STORM verification), an investigator (narrative and timeline), and a remediation agent (grounded diagnostic steps), each an OpenAI tool-calling agent.
- **Runbook-grounded remediation (agentic RAG).** The remediation and investigator agents retrieve from a NOC runbook and past-incident knowledge base (ChromaDB vector store plus OpenAI embeddings) and cite the playbook id behind each step, so recommendations reflect real operational procedure rather than generic model knowledge.
- **Upload your own data.** Analyze any contract-conforming incident bundle, not just the canned demo.
- **Healthy-state detection.** Upload a fault-free dataset and receive an "All Systems Nominal" report that explains *why* it is healthy.
- **Tamper-evident audit trail.** Every investigation step is written to a SHA-256 hash-chained log with a verification endpoint.
- **Deterministic and reproducible.** Same input yields the same ranking on every run, verified in the test suite.
- **Two analysis modes.** An instant deterministic report (no API key required) or a full LLM-enriched investigation.
- **Synthetic incident generator.** Injects a *known* root cause into the topology to benchmark recovery accuracy honestly.

## Architecture

<p align="center">
  <img src="docs/architecture.png?v=2" alt="System architecture pipeline: five typed data inputs flow into anomaly detection and the topology-constrained causal engine, which together form the deterministic core, then into the bounded OpenAI reasoning layer with agentic RAG over a NOC knowledge base, the FastAPI backend, and the Next.js NOC dashboard, with a SHA-256 hash-chained audit trail spanning every step." width="960">
</p>

Data flows top to bottom. The **deterministic core** (anomaly detection plus the causal engine) decides the root cause; the **bounded AI layer** only explains and verifies it; and a **SHA-256 hash-chained audit trail** spans every step so the entire investigation is independently verifiable.

Every layer is developed against a **frozen data contract** (`contracts/schemas.py`), which is why detection, causal inference, the agents, and the frontend could all be built in parallel and still fit together precisely.

## System layers

The project is organised as six isolated layers. Freezing the data contract first (layer 0) allowed every subsequent layer to be built and tested independently against the same object shapes.

| Layer | Responsibility | Location |
|---|---|---|
| Data contract | The frozen, machine-checked shape of every shared object, with domain invariants | `contracts/` |
| Data and ground truth | Realistic incident data with a recorded, known-in-advance true root cause | `testbed/`, `contracts/fixtures/` |
| Anomaly detection | Robust baselines and change-point detection that recover each anomaly's onset time | `src/rca/detect/` |
| Causal engine | Topology-constrained candidate filtering, attribution, counterfactuals, and ranking | `src/rca/graph/`, `src/rca/causal/` |
| AI, API, and audit | Bounded OpenAI agents, the FastAPI service, and the hash-chained audit ledger | `src/rca/agents/`, `src/rca/api/`, `src/rca/audit/` |
| Frontend | The Next.js NOC dashboard: graph, evidence ledger, timeline, upload, and healthy view | `web/` |

## How it works

1. **Ingest.** An incident is a bundle of contract-typed streams: a `topology` (components plus dependency edges), `telemetry` (per-component metric windows), and optional `logs`, `alerts`, and `config_changes`.
2. **Detect.** A MAD (median-absolute-deviation) baseline over a pre-incident window, combined with PELT change-point detection, flags anomalies and, crucially, their **onset time** rather than just a threshold crossing.
3. **Constrain.** Candidate root causes are filtered to anomalous components that have a **topology dependency path** to the symptom. Components with no path are rejected as decoys, and the rejection is surfaced to the user.
4. **Attribute and rank.** A weighted model combines topology-constrained causal attribution (DoWhy, with a deterministic fallback), config-change proximity, evidence strength, temporal precedence, "rootness" (how many other suspects a candidate explains), and severity. Severity is deliberately down-weighted so victims never outrank causes.
5. **Explain (optional AI).** The skeptic agent adversarially tries to *disprove* the top hypotheses; the investigator writes the timeline and narrative; the remediation agent retrieves the matching NOC runbooks from the knowledge base and converts the missing-evidence ledger into concrete diagnostic steps that cite the playbook they came from.
6. **Audit.** Every step is appended to a hash-chained ledger that can be independently verified.

### How the ranking is weighted

The confidence score is a transparent weighted combination of the signals above, not a hidden model. The weighting is deliberate: the majority of the score sits on causal attribution, what recently changed, and evidence strength, while severity (how bad a component *looks*) carries the smallest share. That is precisely why the true cause wins even when a downstream victim shows scarier numbers, and why decoys are floored below every genuine candidate.

## Tech stack

| Layer | Choice |
|---|---|
| Data contract | Pydantic v2 (frozen models, exported JSON Schema) |
| Anomaly detection | NumPy and SciPy robust baselines, `ruptures` PELT change-point |
| Causal engine | `networkx` topology twin, DoWhy GCM attribution (deterministic fallback), seeded for reproducibility |
| Reasoning agents | OpenAI (structured outputs plus native tool-calling), bounded confidence influence |
| Knowledge / RAG | ChromaDB vector store, OpenAI `text-embedding-3-small` embeddings, runbook and past-incident retrieval |
| API | FastAPI and Uvicorn |
| Frontend | Next.js 15, React 19, Cytoscape.js, Recharts, Tailwind, Framer Motion |
| Audit | SHA-256 hash-chained JSONL ledger |

## Repository structure

```
contracts/          frozen data contract: schemas.py, schemas.json, golden fixture + streams
src/rca/
  detect/           anomaly detection (baseline, change-point, windowing)
  graph/            networkx topology twin + impact-path / blast-radius queries
  causal/           candidate filter, attribution, counterfactual, evidence ledger, ranker
  agents/           OpenAI skeptic / investigator / remediation + the tool-calling runner
  knowledge/        agentic RAG retrieval over the runbook + past-incident knowledge base (ChromaDB)
  synth/            synthetic incident generator (inject a known cause, benchmark recovery)
  audit/            SHA-256 hash-chained audit log + verifier
  api/              FastAPI routes (topology, incident, replay, analyze, audit, stats)
knowledge/          NOC runbook corpus + past-incident corpus (source for the RAG index)
scripts/            build_knowledge.py (build the vector index)
eval/               accuracy benchmarks (synth_eval.py, run_eval.py)
web/                Next.js NOC dashboard (upload, analyze, report; healthy view)
tests/              contract + engine + detection + generator + upload + retrieval suites (340+ tests)
docs/               architecture diagram, demo script
Makefile            setup / lint / test / check targets
```

## Running locally

### Prerequisites

- **Python 3.11 or newer**
- **Node 20 or newer**
- An **OpenAI API key**, required *only* for the "Full AI investigation" mode. The deterministic engine, the API, the upload flow, and the reference incident all run **without** it.

### 1. Backend

```bash
# from the repository root
make setup                              # create .venv and install Python dependencies
cp .env.example .env                    # then edit .env:  OPENAI_API_KEY=sk-...  OPENAI_MODEL=gpt-4.1

# (optional) build the RAG knowledge index up front; it also builds lazily on first use
PYTHONPATH=src .venv/bin/python scripts/build_knowledge.py

# start the API (http://localhost:8000)
PYTHONPATH=src .venv/bin/uvicorn rca.api.main:app --port 8000
```

Quick check: `curl -s localhost:8000/health` returns `{"status":"ok"}`.

### 2. Frontend (in a second terminal)

```bash
cd web
npm install
npm run dev                             # http://localhost:3000
```

Open **http://localhost:3000**. The dashboard proxies `/api/*` to the backend on port 8000 (configured in `web/next.config.ts`), so both servers must be running for uploads to work.

> **Tip:** do not run `npm run build` while `npm run dev` is live. It rewrites the `.next` cache and can cause "Cannot find module" errors. If that happens, run `rm -rf web/.next && npm run dev`.

### One-command sanity check

```bash
make check                              # ruff lint + full test suite (300+ tests)
cd web && npx tsc --noEmit              # frontend type-check
```

## Using the application

> The **[hosted demo](https://tech-mcode-team5.vercel.app/)** runs the worked reference incident end to end with no setup. To analyze your own bundles or run the full LLM investigation, start the project locally as above.

From the landing page you can:

- **Launch the reference incident.** A fully worked example (`INC-1001`: a database connection-pool exhaustion propagating to the web tier) with the topology graph, ranked hypotheses, evidence ledger, timeline, and audit trail.
- **Analyze your own incident.** Paste an incident bundle, upload a JSON file, or click **Try Sample** (loads `web/public/sample_incident.json`). The result renders in the same dashboard.
- **Toggle "Full AI investigation".** Off gives an **instant deterministic** report (ranking, evidence, timeline, counterfactual). On gives the full **LLM-enriched** investigation (adversarial skeptic verdicts, AI narrative, and grounded remediation, roughly 40 seconds, requires `OPENAI_API_KEY`).
- **Upload healthy data.** A fault-free bundle produces an **"All Systems Nominal"** dashboard: the all-green topology graph plus the exact checks that passed (windows analyzed, zero change-points, all KPIs within baseline).

The topology graph colours the **root cause red**, the **impact path amber**, and **all healthy nodes green**. Clicking any node opens a detail panel with its real per-node telemetry peaks, alerts, logs, and config audits.

## Input data format

An incident bundle is JSON conforming to the frozen contract (`contracts/schemas.py`, exported to `contracts/schemas.json`):

```jsonc
{
  "topology": {
    "components":    [ { "component_id": "db-01", "component_type": "database", "tier": "data", "rack": "R1", "capacity_mbps": 1000 } ],
    "dependencies":  [ { "source_id": "app-03", "target_id": "db-01", "relation": "DEPENDS_ON" } ]
  },
  "telemetry":       [ { "component_id": "db-01", "window_start": "2026-01-01T14:00:00Z", "latency_ms": 22.0, "connection_count": 48, "cpu_pct": 32.0 } ],
  "logs":            [ { "component_id": "db-01", "ts": "2026-01-01T14:32:00Z", "severity": "ERROR", "template": "connection pool exhausted" } ],
  "alerts":          [ { "alert_id": "ALT-9001", "component_id": "web-02", "ts": "2026-01-01T14:32:10Z", "severity": "CRITICAL", "metric": "latency_ms", "threshold": 100, "observed": 165 } ],
  "config_changes":  [ { "change_id": "CHG-4212", "component_id": "db-01", "ts": "2026-01-01T14:31:50Z", "change_type": "db_param_update", "before": {}, "after": {} } ],
  "symptom_component": "web-02"
}
```

**Minimum required:** `topology` plus `telemetry`. Logs, alerts, and config changes enrich the evidence ledger. **Topology is what unlocks causation**; without it the system can only perform correlation-based detection. `web/public/sample_incident.json` is a complete, ready-to-upload example. The optional `symptom_component` is inferred by the engine when omitted.

## API reference

| Method and path | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /topology` | The reference topology (components plus dependencies) |
| `GET /incidents/{id}` | The pre-computed reference incident report |
| `POST /analyze` | Analyze an uploaded bundle and return a full LLM report. Add `?fast=true` for the instant deterministic report; returns a healthy result when no anomalies are found. |
| `POST /incidents/analyze` | Investigate pre-ranked hypotheses (LLM narrative only) |
| `POST /replay/{scenario}` | Replay the built-in reference scenario through the live pipeline |
| `GET /audit/verify` | Verify the SHA-256 audit chain integrity |

## Testing

```bash
make check                               # ruff (lint) + full pytest suite (300+ tests)
make lint                                # lint only
make test                                # tests only
.venv/bin/python -m pytest tests/ -q     # direct
cd web && npx tsc --noEmit               # frontend type-check
```

The suite covers the frozen contract invariants, the causal engine (ranking, determinism, decoy rejection), detection, the synthetic generator (recovery), and the upload path.

## Evaluation and accuracy

The headline number comes from the **synthetic incident benchmark**. It injects a **known** root cause into the real topology (across all fault types and tiers) and measures whether the engine recovers it. The ground truth is *never* shown to the engine.

```bash
PYTHONPATH=src:. .venv/bin/python eval/synth_eval.py     # writes eval/synth_results.md
```

> **Result: 100 percent root-cause accuracy@1** (and @3) on the injected incidents, deterministic across runs.

On the golden reference incident, the engine correctly ranks `db-01` first and **rejects the tempting decoys** (a config change 10 seconds before onset, a cache latency blip) because they have no dependency path to the symptom. This is the causation-versus-correlation story on one screen.

*(`eval/run_eval.py` is a separate, weaker benchmark that scores raw detection on hardware-only signal from captured flows. It is not representative of the causal engine and is kept only for reference.)*

## Design decisions and FAQ

**Why a deterministic core instead of just asking an LLM?**
Root-cause analysis must be trustworthy and reproducible. An LLM asked "what is the root cause?" is a slot machine: plausible but unaccountable, and different on every run. Our engine is deterministic and every ranking decision is explainable from the evidence ledger. The LLM is used only for language tasks (explanation, adversarial review, remediation), where it adds value without risking correctness.

**How does it actually separate causation from correlation?**
By constraining candidates to those with a real topology dependency path to the symptom, and by deliberately down-weighting severity while up-weighting causal attribution, config proximity, evidence, and rootness. A victim that looks worse than its cause still loses, because it cannot explain the other victims and the cause can.

**Does it need Docker or a special testbed to run?**
No. It is mathematics, graph traversal, and API calls over whatever contract-conforming data you provide. Upload a dataset and it works.

**Is it deterministic?**
Yes. The causal ranking is deterministic (DoWhy is seeded and the fallback is pure). The LLM layer is the only non-deterministic part, and it is bounded so it can never change the top-ranked cause.

**What data does it need?**
Telemetry plus topology at minimum (topology is what enables causation). Logs, alerts, and config changes enrich the evidence but are not required.

**Is there an audit trail?**
Yes. A SHA-256 hash-chained ledger of every investigation step, verifiable at `GET /audit/verify`.

## Known limitations and roadmap

- **Deep-path non-config faults.** For a non-config fault three or more hops deep, causal attribution can occasionally rank an intermediate hop first, dropping the true cause to second or third. Config faults and shallow faults recover robustly. A rootness tie-break in the ranker is the planned fix.
- **The "Full AI investigation" mode** requires `OPENAI_API_KEY`. The deterministic mode is the always-available default.
- **Displayed fault type** is inferred from config presence, so a non-config injected fault may display a related fault label.
- **Roadmap:** a ranker tie-break for deep non-config paths, feedback-driven retrieval ranking and an expanded runbook corpus for the RAG layer, and ingestion adapters for additional real-capture datasets.

## Licence

MIT
