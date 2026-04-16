import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import {
  createVehicleLibraryItem,
  mergeVehicleLibraries,
  parseVehicleLibraryText,
  serializeVehicleLibrary,
} from "../app/vehicleLibrary";

describe("vehicle library", () => {
  it("creates a reusable library item from the current vehicle", () => {
    const model = createDefaultModel();
    model.vehicle.name = "Crawler Crane";

    const item = createVehicleLibraryItem(model.vehicle);

    expect(item.name).toBe("Crawler Crane");
    expect(item.id).toMatch(/^vehicle-/);
    expect(item.vehicle).toEqual(model.vehicle);
    expect(item.vehicle).not.toBe(model.vehicle);
  });

  it("merges imported vehicles without keeping duplicate ids", () => {
    const baseVehicle = createDefaultModel().vehicle;
    const existing = [
      createVehicleLibraryItem(baseVehicle, { id: "veh-1", name: "Existing" }),
    ];
    const imported = [
      createVehicleLibraryItem(baseVehicle, { id: "veh-1", name: "Imported" }),
    ];

    const result = mergeVehicleLibraries(existing, imported);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("veh-1");
    expect(result.items[1].id).not.toBe("veh-1");
    expect(result.addedIds).toEqual([result.items[1].id]);
  });

  it("round-trips an exported vehicle library payload", () => {
    const model = createDefaultModel();
    model.vehicle.name = "Transfer Trailer";
    const library = [createVehicleLibraryItem(model.vehicle, { id: "veh-tt" })];

    const text = serializeVehicleLibrary(library);
    const parsed = parseVehicleLibraryText(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("veh-tt");
    expect(parsed[0].name).toBe("Transfer Trailer");
    expect(parsed[0].vehicle.mode).toBe(model.vehicle.mode);
  });
});
