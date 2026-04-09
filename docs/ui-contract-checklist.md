# Workbench UI Contract Checklist

## 1. Layout & View Modes
- [x] `2.5-pane Workbench + Contextual Evidence Drawer` implemented correctly
- [x] `Header`, `Decision Bar`, `Context Rail`, `Compare Canvas`, `Decision Rail`, `Evidence Drawer`, `Approval Modal` are all present
- [x] `Overview`, `Compare`, `Audit` view modes functioning
- [x] `Recommended`, `Cheapest`, `Fastest` scenario toggles functioning

## 2. Contextual Evidence Drawer & Interactions
- [x] Tab ordering and content conform to spec (`Overview`, `Route Legs`, `Cost`, `Transit`, `Docs`, `WH`, `Evidence`, `Trace`)
- [x] Open/close behavior (row click, View details, `Esc` close) is focus trapped and correctly sequenced

## 3. Approval Flow & Constraints
- [x] `Approve`, `Hold`, `Request Re-evaluation` CTA correctly separated
- [x] No execution CTA mixed with approval surface
- [x] `execution_eligible` remains `false` until proper approval flow concludes

## 4. Accessibility
- [x] Keyboard navigation and `Esc` close fully testable
- [x] Screen reader and high contrast support for status/reason indicators validated
