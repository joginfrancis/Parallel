# SVG Import / Export (Phase 9)

Round-tripping the document to/from standalone SVG. All geometry is in **mm**;
SVG `viewBox` units are mm and `width`/`height` carry the `mm` suffix so files
print and laser-cut at true size.

## Files

| File | Purpose |
|------|---------|
| `svgExport.ts` | `shapesToSvg(shapes, opts)` → SVG string (pure). `downloadSvg(svg, name)` triggers a browser download. |
| `svgImport.ts` | `svgToShapes(svgString)` → `Shape[]` (needs DOM `DOMParser`). |
| `importToDocument.ts` | `importSvgText` / `importSvgFile` — parse + add to the document (one undo step) + select + friendly toast. |
| `io.selftest.ts` | Node-runnable export self-test: `npx tsx src/core/io/io.selftest.ts`. |

## Export mapping

- **rectangle** → `<rect>` (+ `rx`, + `transform="rotate(...)"` when rotated)
- **circle** → `<circle>`
- **line** → `<line>`
- **arc** → `<path d="M… A…">` (computes the circumcircle; sweep/large-arc flags
  from the angle the arc passes through — SVG-spec correct)
- **path** → `<path>` with `L` for corners and `C` for segments that have bezier
  handles; `Z` when closed
- **text** → `<text>` (font-size, text-anchor from `align`, `font-weight`, `fill`,
  rotation transform; XML-escaped content)
- **image** → `<image>` (x/y/width/height, `opacity`, rotation transform, `href`
  data URL)

Output is black outline (stroke, no fill) — the conventional, re-importable form.

## Import mapping

`rect, circle, ellipse(→circle), line, polyline(→open path), polygon(→closed path),
path, text, image`. Text reads `font-size`/`font-weight`/`fill`/`text-anchor` from
either presentation attributes or `style="..."`; image reads `href` or
`xlink:href`. Path data supports **M L H V C S Q T A Z**
(absolute + relative); Q/T are
elevated to cubic, S/T reflect the previous control point, and `A` uses the SVG
endpoint→center conversion (spec F.6.5). A subpath that is exactly `M … A`
round-trips back to an **ArcShape**; other arcs are sampled into nodes.

**Limitations:** element transforms other than rect `rotate(...)` are ignored;
styling is dropped (geometry only). Returns `[]` on parse failure.

## Verification

- Export: 15/15 `io.selftest.ts` checks (node), covering every shape type incl.
  text and image.
- Import + round-trip: verified in-browser (needs `DOMParser`) — all shape types
  export→import→re-export, and foreign hand-written SVGs import to correct editable
  shapes (rect/circle/path/curve-with-handles/arc/text/image, incl. `style=`,
  presentation attrs, and `xlink:href`).
