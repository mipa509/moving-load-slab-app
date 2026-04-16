# Moving Load Slab App V3 Specification

This document records the implemented vehicle-library workflow added after the v2 usability pass. It extends the current app behavior described in [v2-specification.md](./v2-specification.md).

## 1. V3 Summary

V3 adds a reusable vehicle library so vehicle definitions do not need to be rebuilt by hand every session. The library is intended to support repeated engineering checks with known plant, trailers, modular transporters, or custom wheel sets.

The v3 batch focuses on persistence and reuse, not solver changes.

## 2. Implemented Changes

### Browser-persisted vehicle library

- The app now supports a saved vehicle library stored in browser `localStorage`.
- Each saved item stores:
  - library item id
  - display name
  - full vehicle definition
  - last updated timestamp
- The library is separate from the slab model JSON file.

### Vehicle library actions

- `Save Current` stores the active vehicle definition as a new library item.
- `Load Selected` replaces the active vehicle definition with the selected saved vehicle.
- `Overwrite Selected` updates the selected saved vehicle using the current active vehicle.
- `Duplicate Selected` creates a new saved item from the selected library item.
- `Delete Selected` removes the selected saved vehicle from the library.

### Import and export

- The full vehicle library can now be exported as JSON.
- A vehicle library JSON file can be imported back into the app.
- Imported vehicles are merged into the current library rather than replacing it.
- Duplicate ids from imported files are regenerated automatically so existing library entries are preserved.

### Validation and sanitization

- Imported vehicle definitions are sanitized through the same vehicle-shape normalization used by the main app model.
- Library helper tests cover:
  - saved-item creation
  - duplicate-id merge handling
  - export/import round-tripping

## 3. UX Notes

- The library is managed from a dedicated `Vehicle Library` panel in the control column.
- The panel shows the saved vehicle count and currently selected saved item.
- Library operations show inline status feedback in the panel.
- Loading a saved vehicle triggers the existing auto-rerun pipeline because it updates the active model.

## 4. Out of Scope

Still not included in v3:

- cloud/shared vehicle library
- library folders or tags
- search/filter over large saved-vehicle lists
- per-project embedded vehicle presets inside model JSON
- thumbnail or axle diagram previews in the library list
