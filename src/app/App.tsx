import { startTransition, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createDefaultModel,
  errorResults,
  idleResults,
  sanitizeLoadedModel,
  validateModelForRun,
} from "./defaults";
import { buildAutoRunSignature } from "./autoRun";
import { runFixedAnalysis } from "./solverAdapter";
import { runPathEnvelope, type EnvelopeProgress } from "./runPathEnvelope";
import {
  cloneVehicleDefinition,
  createVehicleLibraryItem,
  loadVehicleLibraryFromStorage,
  mergeVehicleLibraries,
  parseVehicleLibraryText,
  saveVehicleLibraryToStorage,
  serializeVehicleLibrary,
} from "./vehicleLibrary";
import type {
  AnalysisResults,
  ResultField,
  SlabModel,
  VehicleLibraryItem,
} from "./types";
import { ControlPanel } from "../components/ControlPanel";
import { Viewport } from "../components/Viewport";
import { ReportNote } from "../components/ReportNote";

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
  const [vehicleLibrary, setVehicleLibrary] = useState<VehicleLibraryItem[]>(() =>
    loadVehicleLibraryFromStorage(),
  );
  const [selectedVehicleLibraryId, setSelectedVehicleLibraryId] = useState("");
  const [vehicleLibraryStatus, setVehicleLibraryStatus] = useState<string | undefined>(
    undefined,
  );
  const [results, setResults] = useState<AnalysisResults>(() => idleResults());
  const [selectedResultField, setSelectedResultField] = useState<ResultField>("deflection");
  const [running, setRunning] = useState(false);
  const [envelopeRunning, setEnvelopeRunning] = useState(false);
  const [envelopeProgress, setEnvelopeProgress] = useState<EnvelopeProgress | null>(null);
  const [reportImages, setReportImages] = useState<{
    currentMx?: string;
    currentMy?: string;
    envelopeMx?: string;
    envelopeMy?: string;
    envelopeMxStationM?: number;
    envelopeMyStationM?: number;
    envelopeMxPeak?: number;
    envelopeMyPeak?: number;
    envelopeUnits?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const autoRunTimeoutRef = useRef<number | null>(null);
  const activeRunIdRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoRunSignature = buildAutoRunSignature(model);

  const handleRunAnalysis = async (nextModel: SlabModel) => {
    const issues = validateModelForRun(nextModel);
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    if (issues.length > 0) {
      setRunning(false);
      setResults(errorResults(issues.join(" ")));
      return;
    }

    setRunning(true);
    setResults((prev) => ({
      ...prev,
      status: "running",
      error: undefined,
      warning: undefined,
    }));

    const nextResults = await runFixedAnalysis(nextModel);
    if (runId !== activeRunIdRef.current) {
      return;
    }

    const previousEnvelope = results.envelope;
    const previousSignature = previousEnvelope?.signature;
    const nextSignature = buildAutoRunSignature(nextModel);
    const carryEnvelope =
      previousEnvelope && previousSignature === nextSignature
        ? previousEnvelope
        : undefined;

    startTransition(() => {
      setResults({ ...nextResults, envelope: carryEnvelope });
      setRunning(false);
    });
  };

  const handleRunEnvelope = async () => {
    if (envelopeRunning || running) return;
    const issues = validateModelForRun(model);
    if (issues.length > 0) {
      setResults(errorResults(issues.join(" ")));
      return;
    }
    setEnvelopeRunning(true);
    setEnvelopeProgress(null);
    try {
      const envelope = await runPathEnvelope(model, (progress) => {
        setEnvelopeProgress(progress);
      });
      setResults((prev) => ({ ...prev, envelope }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        warning:
          error instanceof Error
            ? `Envelope failed: ${error.message}`
            : "Envelope failed.",
      }));
    } finally {
      setEnvelopeRunning(false);
      setEnvelopeProgress(null);
    }
  };

  const envelopeStationCount = useMemo(() => {
    const { pathStartM, pathEndM, pathStepM } = model.placement;
    const span = Math.abs(pathEndM - pathStartM);
    if (span <= 1e-9) return 1;
    const step = Math.max(Math.abs(pathStepM), 0.05);
    return Math.max(1, Math.floor(span / step + 1e-9)) + 1;
  }, [model.placement.pathStartM, model.placement.pathEndM, model.placement.pathStepM]);

  const envelopeSignatureMatchesModel =
    results.envelope?.signature === buildAutoRunSignature(model);
  const hasEnvelope = Boolean(results.envelope);
  const envelopeStale = hasEnvelope && !envelopeSignatureMatchesModel;

  useEffect(() => {
    if (autoRunTimeoutRef.current !== null) {
      window.clearTimeout(autoRunTimeoutRef.current);
    }

    autoRunTimeoutRef.current = window.setTimeout(() => {
      void handleRunAnalysis(model);
    }, 150);

    return () => {
      if (autoRunTimeoutRef.current !== null) {
        window.clearTimeout(autoRunTimeoutRef.current);
      }
    };
  }, [autoRunSignature]);

  useEffect(() => {
    saveVehicleLibraryToStorage(vehicleLibrary);
  }, [vehicleLibrary]);

  useEffect(() => {
    setSelectedVehicleLibraryId((current) =>
      vehicleLibrary.some((item) => item.id === current)
        ? current
        : (vehicleLibrary[0]?.id ?? ""),
    );
  }, [vehicleLibrary]);

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
    } catch {
      setResults(errorResults("Failed to load JSON model file."));
    } finally {
      event.target.value = "";
    }
  };

  const waitFrames = (count: number) =>
    new Promise<void>((resolve) => {
      let remaining = count;
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
        } else {
          window.requestAnimationFrame(tick);
        }
      };
      window.requestAnimationFrame(tick);
    });

  const handleExportPdf = async () => {
    if (results.status !== "success") {
      window.print();
      return;
    }

    const prevField = selectedResultField;
    const prevPlotMode = model.display.plotMode;

    try {
      setSelectedResultField("mx");
      setModel((curr) => ({ ...curr, display: { ...curr.display, plotMode: "results" } }));
      await waitFrames(4);
      const currentMx = canvasRef.current?.toDataURL("image/png");

      setSelectedResultField("my");
      await waitFrames(4);
      const currentMy = canvasRef.current?.toDataURL("image/png");

      setReportImages({ currentMx, currentMy });
      await waitFrames(2);
      window.print();
    } finally {
      setSelectedResultField(prevField);
      setModel((curr) => ({ ...curr, display: { ...curr.display, plotMode: prevPlotMode } }));
    }
  };

  const getSelectedVehicleLibraryItem = (): VehicleLibraryItem | undefined =>
    vehicleLibrary.find((item) => item.id === selectedVehicleLibraryId);

  const handleSaveVehicleToLibrary = () => {
    const nextItem = createVehicleLibraryItem(model.vehicle);
    setVehicleLibrary((current) => [...current, nextItem]);
    setSelectedVehicleLibraryId(nextItem.id);
    setVehicleLibraryStatus(`Saved "${nextItem.name}" to the vehicle library.`);
  };

  const handleLoadVehicleFromLibrary = () => {
    const selectedItem = getSelectedVehicleLibraryItem();
    if (!selectedItem) {
      setVehicleLibraryStatus("Select a saved vehicle before loading.");
      return;
    }

    setModel((current) => ({
      ...current,
      vehicle: cloneVehicleDefinition(selectedItem.vehicle),
    }));
    setVehicleLibraryStatus(`Loaded "${selectedItem.name}" from the vehicle library.`);
  };

  const handleOverwriteVehicleInLibrary = () => {
    const selectedItem = getSelectedVehicleLibraryItem();
    if (!selectedItem) {
      setVehicleLibraryStatus("Select a saved vehicle before overwriting.");
      return;
    }

    const nextItem = createVehicleLibraryItem(model.vehicle, {
      id: selectedItem.id,
      name: model.vehicle.name || selectedItem.name,
    });
    setVehicleLibrary((current) =>
      current.map((item) => (item.id === selectedItem.id ? nextItem : item)),
    );
    setVehicleLibraryStatus(`Overwrote "${nextItem.name}" in the vehicle library.`);
  };

  const handleDuplicateVehicleInLibrary = () => {
    const selectedItem = getSelectedVehicleLibraryItem();
    if (!selectedItem) {
      setVehicleLibraryStatus("Select a saved vehicle before duplicating.");
      return;
    }

    const duplicate = createVehicleLibraryItem(selectedItem.vehicle, {
      name: `${selectedItem.name} Copy`,
    });
    setVehicleLibrary((current) => [...current, duplicate]);
    setSelectedVehicleLibraryId(duplicate.id);
    setVehicleLibraryStatus(
      `Duplicated "${selectedItem.name}" as "${duplicate.name}".`,
    );
  };

  const handleDeleteVehicleFromLibrary = () => {
    const selectedItem = getSelectedVehicleLibraryItem();
    if (!selectedItem) {
      setVehicleLibraryStatus("Select a saved vehicle before deleting.");
      return;
    }

    setVehicleLibrary((current) =>
      current.filter((item) => item.id !== selectedItem.id),
    );
    setVehicleLibraryStatus(`Deleted "${selectedItem.name}" from the vehicle library.`);
  };

  const handleExportVehicleLibrary = () => {
    if (vehicleLibrary.length === 0) {
      setVehicleLibraryStatus("No saved vehicles available to export.");
      return;
    }

    downloadFile(
      "moving-load-slab-vehicle-library.json",
      serializeVehicleLibrary(vehicleLibrary),
      "application/json",
    );
    setVehicleLibraryStatus(
      `Exported ${vehicleLibrary.length} vehicle${
        vehicleLibrary.length === 1 ? "" : "s"
      } from the library.`,
    );
  };

  const handleImportVehicleLibraryClick = () => {
    vehicleLibraryInputRef.current?.click();
  };

  const handleImportVehicleLibrary = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const importedItems = parseVehicleLibraryText(text);
      if (importedItems.length === 0) {
        throw new Error("No vehicle definitions were found in the import file.");
      }

      const mergeResult = mergeVehicleLibraries(vehicleLibrary, importedItems);
      setVehicleLibrary(mergeResult.items);
      setSelectedVehicleLibraryId(mergeResult.addedIds[0] ?? "");
      setVehicleLibraryStatus(
        `Imported ${mergeResult.addedIds.length} vehicle${
          mergeResult.addedIds.length === 1 ? "" : "s"
        } into the library.`,
      );
    } catch (error) {
      setVehicleLibraryStatus(
        error instanceof Error
          ? error.message
          : "Failed to import the vehicle library file.",
      );
    } finally {
      event.target.value = "";
    }
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
      <input
        ref={vehicleLibraryInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportVehicleLibrary}
        hidden
      />
      <ControlPanel
        model={model}
        vehicleLibrary={vehicleLibrary}
        selectedVehicleLibraryId={selectedVehicleLibraryId}
        vehicleLibraryStatus={vehicleLibraryStatus}
        selectedResultField={selectedResultField}
        running={running}
        envelopeRunning={envelopeRunning}
        envelopeProgress={envelopeProgress}
        envelopeStationCount={envelopeStationCount}
        hasEnvelope={hasEnvelope}
        envelopeStale={envelopeStale}
        onModelChange={setModel}
        onVehicleLibrarySelectionChange={(vehicleLibraryId) => {
          setSelectedVehicleLibraryId(vehicleLibraryId);
          setVehicleLibraryStatus(undefined);
        }}
        onSaveVehicleToLibrary={handleSaveVehicleToLibrary}
        onLoadVehicleFromLibrary={handleLoadVehicleFromLibrary}
        onOverwriteVehicleInLibrary={handleOverwriteVehicleInLibrary}
        onDuplicateVehicleInLibrary={handleDuplicateVehicleInLibrary}
        onDeleteVehicleFromLibrary={handleDeleteVehicleFromLibrary}
        onExportVehicleLibrary={handleExportVehicleLibrary}
        onImportVehicleLibraryClick={handleImportVehicleLibraryClick}
        onResultFieldChange={setSelectedResultField}
        onRunAnalysis={() => {
          if (autoRunTimeoutRef.current !== null) {
            window.clearTimeout(autoRunTimeoutRef.current);
          }
          void handleRunAnalysis(model);
        }}
        onRunEnvelope={() => {
          void handleRunEnvelope();
        }}
        onSaveJson={handleSaveJson}
        onLoadJsonClick={handleLoadJsonClick}
        onExportPdf={handleExportPdf}
      />
      <Viewport
        model={model}
        results={results}
        selectedField={selectedResultField}
        onModelChange={setModel}
        onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
        }}
      />
      <ReportNote
        model={model}
        results={results}
        images={{ mx: reportImages.currentMx, my: reportImages.currentMy }}
      />
    </div>
  );
};
