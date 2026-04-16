import { createDefaultModel, sanitizeVehicleDefinition } from "./defaults";
import type {
  VehicleDefinition,
  VehicleLibraryExport,
  VehicleLibraryItem,
} from "./types";

const VEHICLE_LIBRARY_STORAGE_KEY = "moving-load-slab-app.vehicle-library.v1";

export interface VehicleLibraryMergeResult {
  items: VehicleLibraryItem[];
  addedIds: string[];
}

export function cloneVehicleDefinition(
  vehicle: VehicleDefinition,
): VehicleDefinition {
  return JSON.parse(JSON.stringify(vehicle)) as VehicleDefinition;
}

export function createVehicleLibraryItem(
  vehicle: VehicleDefinition,
  overrides: Partial<Pick<VehicleLibraryItem, "id" | "name" | "updatedAtIso">> = {},
): VehicleLibraryItem {
  const fallbackVehicle = createDefaultModel().vehicle;

  return {
    id: normalizeLibraryId(overrides.id),
    name: normalizeVehicleName(
      overrides.name ?? vehicle.name,
      "Saved Vehicle",
    ),
    vehicle: sanitizeVehicleDefinition(
      cloneVehicleDefinition(vehicle),
      fallbackVehicle,
    ),
    updatedAtIso: normalizeTimestamp(overrides.updatedAtIso),
  };
}

export function normalizeVehicleLibrary(
  input: unknown,
): VehicleLibraryItem[] {
  const fallbackVehicle = createDefaultModel().vehicle;
  const seenIds = new Set<string>();
  const items = readVehicleLibraryArray(input);

  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const vehicleSource = "vehicle" in item ? item.vehicle : item;
    const vehicle = sanitizeVehicleDefinition(vehicleSource, fallbackVehicle);
    let id = normalizeLibraryId(item.id);
    while (seenIds.has(id)) {
      id = createVehicleLibraryId();
    }
    seenIds.add(id);

    return [
      {
        id,
        name: normalizeVehicleName(item.name, vehicle.name || `Saved Vehicle ${index + 1}`),
        vehicle,
        updatedAtIso: normalizeTimestamp(item.updatedAtIso),
      },
    ];
  });
}

export function mergeVehicleLibraries(
  existing: VehicleLibraryItem[],
  imported: VehicleLibraryItem[],
): VehicleLibraryMergeResult {
  const normalizedExisting = normalizeVehicleLibrary(existing);
  const normalizedImported = normalizeVehicleLibrary(imported);
  const usedIds = new Set(normalizedExisting.map((item) => item.id));
  const addedIds: string[] = [];
  const merged = [...normalizedExisting];

  normalizedImported.forEach((item) => {
    let id = item.id;
    while (usedIds.has(id)) {
      id = createVehicleLibraryId();
    }
    usedIds.add(id);
    merged.push({ ...item, id });
    addedIds.push(id);
  });

  return {
    items: merged,
    addedIds,
  };
}

export function serializeVehicleLibrary(
  items: VehicleLibraryItem[],
): string {
  const payload: VehicleLibraryExport = {
    version: 1,
    exportedAtIso: new Date().toISOString(),
    vehicles: normalizeVehicleLibrary(items),
  };

  return JSON.stringify(payload, null, 2);
}

export function parseVehicleLibraryText(
  text: string,
): VehicleLibraryItem[] {
  return normalizeVehicleLibrary(JSON.parse(text) as unknown);
}

export function loadVehicleLibraryFromStorage(): VehicleLibraryItem[] {
  const storage = getBrowserStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(VEHICLE_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return normalizeVehicleLibrary(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveVehicleLibraryToStorage(
  items: VehicleLibraryItem[],
): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(VEHICLE_LIBRARY_STORAGE_KEY, serializeVehicleLibrary(items));
  } catch {
    // Ignore storage write failures and keep the in-memory library usable.
  }
}

function readVehicleLibraryArray(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }
  if (isRecord(input) && Array.isArray(input.vehicles)) {
    return input.vehicles;
  }
  return [];
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }
  return window.localStorage;
}

function normalizeVehicleName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function normalizeLibraryId(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return createVehicleLibraryId();
}

function createVehicleLibraryId(): string {
  return `vehicle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}
