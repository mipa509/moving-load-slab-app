import { startTransition, useRef, useState, type ChangeEvent } from "react";
import {
  createDefaultModel,
  idleResults,
  sanitizeLoadedModel,
  validateModelForRun,
} from "./defaults";
import { runFixedAnalysis } from "./solverAdapter";
import type { AnalysisResults, ResultField, SlabModel } from "./types";
import { ControlPanel } from "../components/ControlPanel";
import { Viewport } from "../components/Viewport";

const downloadFile = (filename: string, text: string, mimeType: string) => {
  const blob = new Blob([text], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
};

export const App = () => {
  const [model, setModel] = useState<SlabModel>(() => createDefaultModel());
  const [results, setResults] = useState<AnalysisResults>(() => idleResults());
  const [selectedResultField, setSelectedResultField] = useState<ResultField>("deflection");
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRunAnalysis = async () => {
    const issues = validateModelForRun(model);
    if (issues.length > 0) {
      setResults({
        ...idleResults(),
        status: "error",
        error: issues.join(" "),
      });
      return;
    }

    setRunning(true);
    setResults((prev) => ({ ...prev, status: "running" }));
    const nextResults = await runFixedAnalysis(model);
    startTransition(() => {
      setResults(nextResults);
      setRunning(false);
    });
  };

  const handleSaveJson = () => {
    const payload = JSON.stringify(model, null, 2);
    const safeName = model.projectName.trim().replace(/\s+/g, "-").toLowerCase() || "slab-model";
    downloadFile(`${safeName}.json`, payload, "application/json");
  };

  const handleLoadJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setModel(sanitizeLoadedModel(parsed));
      setResults(idleResults());
    } catch {
      setResults({
        ...idleResults(),
        status: "error",
        error: "Failed to load JSON model file.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleLoadJson}
        hidden
      />
      <ControlPanel
        model={model}
        selectedResultField={selectedResultField}
        running={running}
        onModelChange={setModel}
        onResultFieldChange={setSelectedResultField}
        onRunAnalysis={handleRunAnalysis}
        onSaveJson={handleSaveJson}
        onLoadJsonClick={handleLoadJsonClick}
        onExportPdf={handleExportPdf}
      />
      <Viewport model={model} results={results} selectedField={selectedResultField} />
    </div>
  );
};
