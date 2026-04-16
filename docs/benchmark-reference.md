# Transfer Slab Reference Snapshot

Source notebook:

- `C:\Users\bc975770\OneDrive - Skanska\Python\Python - Tata\Arnott Culvert\notebooks\transfer_slab_design.ipynb`

Relevant executed outputs captured during project setup:

## Geometry and mesh summary

- slab width: `5.0 m`
- target mesh size: `0.25 m`
- element thickness: `0.5 m`
- nodes: `924`
- quads: `860`
- support lines at `x = 0.000, 5.000, 7.600, 10.500 m`

## Load and equilibrium summary

- expected ULS total load: `2583.3 kN`
- Case A sum reactions: `2583.3 kN`
- Case B sum reactions: `2583.3 kN`

## Case A

- description: span 1 midspan bending reference
- vehicle reference position: `x_ref = 2.500 m`
- loaded quads: `32`
- plate `Mx min = -303.3 kNm/m`
- plate `Mx max = 240.2 kNm/m`
- plate `My min = -80.4 kNm/m`
- plate `My max = 48.0 kNm/m`
- centreline `max |Qx| = 280.0 kN/m`

## Case B

- description: near-support shear reference
- vehicle reference position: `x_ref = 4.325 m`
- loaded quads: `16`
- plate `Mx min = -108.2 kNm/m`
- plate `Mx max = 140.9 kNm/m`
- plate `My min = -31.5 kNm/m`
- plate `My max = 28.7 kNm/m`
- centreline `max |Qx| = 310.1 kN/m`

## PyCBA comparison values shown in the notebook

- Case A PyCBA span 1 moment: `398.4 kNm/m`
- Case B PyCBA W1-L shear at d: `460.9 kN/m`

## Support reaction snapshot

Case A reactions:

- `x = 0.000 m -> 166.1 kN/m`
- `x = 5.000 m -> 394.8 kN/m`
- `x = 7.600 m -> -80.5 kN/m`
- `x = 10.500 m -> 36.2 kN/m`

Case B reactions:

- `x = 0.000 m -> 55.2 kN/m`
- `x = 5.000 m -> 455.6 kN/m`
- `x = 7.600 m -> -22.3 kN/m`
- `x = 10.500 m -> 28.2 kN/m`
