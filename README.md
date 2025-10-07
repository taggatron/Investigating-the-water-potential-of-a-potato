# PAG 8.1 Interactive: Investigating the Water Potential of Potato Tissue

This lightweight web app (no external libraries) supports OCR A Level Biology Practical Activity Group (PAG) 8.1. It provides:

* Serial dilution calculator + animated visualisation of preparing a sucrose solution using C1V1 = C2V2.
* Interactive feedback on student-entered distilled water volume.
* Data entry table for initial and final masses of potato cylinders.
* Automatic calculation of percentage mass change.
* Dynamic canvas graph (% mass change vs sucrose concentration) with tooltips.
* Estimation of isotonic concentration (where % change ≈ 0) via linear interpolation between flanking points.
* Simple simulation tool to generate plausible final masses for practice (modelled around an isotonic point ~0.28 M).
* SVG apparatus illustrations (beaker, pipette, test tube rack, balance, potato disc) created specifically for this resource.
* Batch dilution series generator: enter multiple concentrations, auto-generate simulated masses, instantly populate table & graph.
* Cylinder response animation: visual shrinking/swelling of potato discs across concentration gradient.

## Running

Just open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No build step required.

## File Overview

* `index.html` – Main structure.
* `css/style.css` – Styling, responsive layout, dark theme.
* `js/app.js` – App bootstrap & event wiring.
* `js/dilutionAnimation.js` – Dilution calculation + SVG animation logic.
* `js/dataModel.js` – Data storage, simulation, isotonic interpolation, persistence.
* `js/chart.js` – Custom canvas scatter + line chart (no dependencies).
* `js/seriesAnimation.js` – Batch series test tube & potato cylinder animation.
* `assets/svg/*.svg` – Purpose-made apparatus illustrations.

## Dilution Logic

Uses the standard relation: `C1 * V1 = C2 * V2` → `V1 = (C2 * V2) / C1`. Required water = `V2 - V1`.
Tolerance for correctness feedback is ±0.15 mL (adjust in `app.js`).

## Isotonic Point

The isotonic sucrose concentration is where % mass change crosses zero. The script finds adjacent data points with opposite signs and linearly interpolates. Add results spanning both sides of zero for an estimate to appear.

## Simulation Model

A simple damped linear/exponential hybrid around an assumed isotonic point (0.28 M) introduces realistic direction and diminishing magnitude with distance plus small random noise.

## Accessibility & Notes

* Semantic regions (`section`, `aside`, `table`, `form`).
* ARIA labels and `role="img"` on decorative SVGs as appropriate.
* High contrast dark theme.

## Extending

* Add export (CSV) by iterating `ExperimentData.points`.
* Provide error bar support (duplicate measurements) and perform regression.
* Replace simple model with logistic regression or polynomial fit.

## License

Created for educational purposes. All SVG apparatus images are original and may be reused under CC-BY 4.0.
