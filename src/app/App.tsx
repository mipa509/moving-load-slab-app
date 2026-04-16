import { startTransition, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  createDefaultModel,
  idleResults,
  sanitizeLoadedModel,
  validateModelForRun,
} from "./defaults";
import { runFixedAnalysis } from "./solverAdapter";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const autoRunTimeoutRef = useRef<number | null>(null);
  const activeRunIdRef = useRef(0);

  const handleRunAnalysis = async (nextModel: SlabModel) => {
    const issues = validateModelForRun(nextModel);
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    if (issues.length > 0) {
      setRunning(false);
      setResults((prev) => ({
        ...prev,
        status: "error",
        error: issues.join(" "),
        warning: undefined,
      }));
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

    startTransition(() => {
      setResults((prev) =>
        nextResults.status === "success"
          ? nextResults
          : {
              ...prev,
              status: "error",
              elapsedMs: nextResults.elapsedMs,
              error: nextResults.error,
              warning: nextResults.warning,
            },
      );
      setRunning(false);
    });
  };

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
  }, [model]);

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
      setResults((prev) => ({
        ...prev,
        status: "error",
        error: "Failed to load JSON model file.",
      }));
    } finally {
      event.target.value = "";
    }
  };

  const handleExportPdf = () => {
    window.print();
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
        onSaveJson={handleSaveJson}
        onLoadJsonClick={handleLoadJsonClick}
        onExportPdf={handleExportPdf}
      />
      <Viewport model={model} results={results} selectedField={selectedResultField} />
    </div>
  );
};
