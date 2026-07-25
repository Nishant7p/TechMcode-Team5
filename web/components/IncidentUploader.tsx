"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FlaskConical, Loader2, AlertCircle, Sparkles, FileJson, X, Info } from "lucide-react";
import { analyzeIncident, DEMO_MODE, REFERENCE_INCIDENT_ID } from "../lib/api";
import { IncidentReport } from "../lib/types";
import AnalysisProgress from "./AnalysisProgress";

interface UploadPayload {
  topology?: { components?: unknown[]; dependencies?: unknown[] };
  telemetry?: unknown[];
  [key: string]: unknown;
}

export default function IncidentUploader() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [enriched, setEnriched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runLabel, setRunLabel] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runAnalysis = async (payload: UploadPayload, label: string) => {
    setBusy(true);
    setError(null);
    setRunLabel(label);
    try {
      const result = await analyzeIncident(payload, !enriched);
      if ("status" in result && result.status === "healthy") {
        const healthyTopo = payload.topology ?? { components: [], dependencies: [] };
        sessionStorage.setItem(
          "healthy:latest",
          JSON.stringify({
            result,
            topology: { components: healthyTopo.components ?? [], dependencies: healthyTopo.dependencies ?? [] },
          }),
        );
        router.push("/healthy");
        return;
      }
      const report = result as IncidentReport;
      const topo = payload.topology ?? { components: [], dependencies: [] };
      sessionStorage.setItem(
        `analyzed:${report.incident_id}`,
        JSON.stringify({
          report,
          topology: { components: topo.components ?? [], dependencies: topo.dependencies ?? [] },
          telemetry: payload.telemetry ?? [],
        }),
      );
      router.push(`/incident/${report.incident_id}`);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed. Check the backend is running on port 8000.");
      setBusy(false);
    }
  };

  const openReference = () => router.push(`/incident/${REFERENCE_INCIDENT_ID}`);

  const parseAndRun = (raw: string, label: string) => {
    // Hosted demo has no live engine: showcase the worked reference incident.
    if (DEMO_MODE) {
      openReference();
      return;
    }
    let payload: UploadPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      setError("That isn't valid JSON. Compare it against the sample format.");
      return;
    }
    if (!payload.topology || !payload.telemetry) {
      setError("Your incident needs at least a 'topology' and a 'telemetry' field.");
      return;
    }
    runAnalysis(payload, label);
  };

  const analyzeSample = async () => {
    if (DEMO_MODE) {
      openReference();
      return;
    }
    setBusy(true);
    setError(null);
    setRunLabel("Sample incident");
    try {
      const response = await fetch("/sample_incident.json");
      const payload: UploadPayload = await response.json();
      await runAnalysis(payload, "Sample incident");
    } catch {
      setError("Could not load the sample dataset.");
      setBusy(false);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(file.name);
      setError(null);
    };
    reader.readAsText(file);
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) readFile(file);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const clearInput = () => {
    setText("");
    setFileName(null);
    setError(null);
  };

  return (
    <div className="w-full surface p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white text-sm font-bold uppercase tracking-wider">Analyze Your Own Incident</h3>
          <p className="text-[var(--text-tertiary)] text-[11px] mt-1">
            Drop a JSON bundle, paste one, or try the bundled sample.
          </p>
        </div>
        <UploadCloud size={20} className="text-[var(--text-tertiary)] shrink-0" aria-hidden />
      </div>

      {DEMO_MODE ? (
        <div className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)] bg-[var(--accent-blue)]/8 border border-[var(--accent-blue)]/25 rounded-[var(--radius-md)] px-3 py-2">
          <Info size={13} className="text-[var(--accent-blue)] shrink-0 mt-px" aria-hidden />
          <span>
            This is the hosted demo. Live analysis of your own data runs on the causal engine backend
            (see the repo to run it locally). Both actions below open the fully worked reference incident.
          </span>
        </div>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-[var(--radius-md)] transition-colors ${
          dragging ? "ring-2 ring-[var(--accent-red)] ring-offset-2 ring-offset-[var(--bg-panel)]" : ""
        }`}
      >
        <label htmlFor="incident-json" className="sr-only">
          Incident bundle JSON
        </label>
        <textarea
          id="incident-json"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          spellCheck={false}
          placeholder={'Paste an incident bundle:  { "topology": {…}, "telemetry": [...], "logs": [...], "alerts": [...] }'}
          className="w-full h-28 bg-[var(--bg-sunken)] border border-[var(--line-hairline)] rounded-[var(--radius-md)] p-3 text-[11px] text-[#D4D4D8] font-mono resize-none transition-colors focus:outline-none focus:border-[var(--accent-red)]/60 disabled:opacity-50"
        />
        {dragging ? (
          <div className="absolute inset-0 rounded-[var(--radius-md)] bg-[var(--bg-sunken)]/90 flex items-center justify-center pointer-events-none">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-red)]">Drop JSON to load</span>
          </div>
        ) : null}
      </div>

      {fileName ? (
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] -mt-1">
          <FileJson size={13} className="text-[var(--accent-green)]" aria-hidden />
          <span className="truncate">{fileName}</span>
          <button
            onClick={clearInput}
            disabled={busy}
            aria-label="Clear loaded file"
            className="ml-auto p-1 rounded hover:bg-[var(--bg-panel-hover)] text-[var(--text-tertiary)] hover:text-white transition-colors disabled:opacity-40"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="interactive px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)] border border-[var(--line-hairline)] rounded-[var(--radius-md)] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Choose JSON file…
        </button>

        <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none ml-auto hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={enriched}
            onChange={(event) => setEnriched(event.target.checked)}
            disabled={busy}
            className="accent-[var(--accent-red)] w-3.5 h-3.5 cursor-pointer"
          />
          <Sparkles size={13} className="text-[var(--accent-amber)]" aria-hidden />
          Full AI investigation
          <span className="text-[var(--text-tertiary)]">(~40s)</span>
        </label>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => parseAndRun(text, "Uploaded incident")}
          disabled={busy || !text.trim()}
          className="interactive flex-1 bg-[var(--accent-red)] hover:bg-[#c00811] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-[var(--radius-md)] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          {busy ? "Analyzing…" : "Analyze Incident"}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={analyzeSample}
          disabled={busy}
          className="interactive px-4 py-2.5 rounded-[var(--radius-md)] text-xs font-bold uppercase tracking-wider border border-[var(--line-hairline)] text-[var(--text-secondary)] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <FlaskConical size={14} className="text-[var(--accent-green)]" aria-hidden />
          Try Sample
        </motion.button>
      </div>

      <AnimatePresence>
        {busy ? <AnalysisProgress key="progress" enriched={enriched} label={runLabel} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="flex items-start gap-2 text-[11px] text-[var(--accent-red)] bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 rounded-[var(--radius-md)] px-3 py-2"
          >
            <AlertCircle size={13} className="shrink-0 mt-px" aria-hidden />
            <span>{error}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
