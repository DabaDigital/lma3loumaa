import fs from "node:fs";
const path = "src/menuShowcase.css";
let s = fs.readFileSync(path, "utf8");
const edits = [
[`.menu-showcase-stage {
  background: #003e48;
  color: var(--cream);
  overflow: clip;
}`, `/* Light stage, teal mezze strip. Brand gold is too pale for text on cream
   (1.4:1), so it stays on surfaces; gold words use the deeper amber. */
.menu-showcase-stage {
  --stage-ink: var(--dark);
  --stage-soft: #4a6567;
  --stage-amber: #b97c12;
  --stage-line: #073d4624;
  background: radial-gradient(ellipse at 50% 40%, #fffdf8 0, #f8f3e9 62%);
  color: var(--stage-ink);
  overflow: clip;
}`],
[`.menu-showcase-more > summary {
  background: transparent;
  color: #f7f5e9;`, `.menu-showcase-more > summary {
  background: transparent;
  color: var(--stage-ink);`],
[`.menu-showcase-categories > button:hover,
.menu-showcase-categories .is-active,
.menu-showcase-more > summary:hover {
  color: var(--gold);
}`, `.menu-showcase-categories > button:hover,
.menu-showcase-more > summary:hover {
  color: var(--stage-amber);
}`],
[`  min-width: 200px;
  box-shadow: 0 12px 28px #002c3860;`, `  min-width: 200px;
  box-shadow: 0 14px 30px #073d462e;`],
[`  border-bottom: 1px solid #ffffff35;
  background: transparent;
  color: var(--cream);
  font-size: 14px;
  min-height: 44px;
}
.menu-showcase-catalog-trigger:hover {
  color: var(--gold);
}`, `  border-bottom: 1px solid #073d4640;
  background: transparent;
  color: var(--stage-ink);
  font-size: 14px;
  min-height: 44px;
}
.menu-showcase-catalog-trigger:hover {
  color: var(--stage-amber);
}`],
[`.menu-showcase-intro h2 span {
  display: block;
  color: var(--gold);
}`, `.menu-showcase-intro h2 span {
  display: block;
  color: var(--stage-amber);
}`],
[`  max-width: 32ch;
  color: #e0e9e4;
}
.menu-showcase-rays {
  color: var(--gold);`, `  max-width: 32ch;
  color: var(--stage-soft);
}
.menu-showcase-rays {
  color: #dda035;`],
[`  margin-top: 26px;
  display: flex;
  padding: 4px;
  border: 1px solid #ffffff45;
  border-radius: 40px;
}`, `  margin-top: 26px;
  display: flex;
  padding: 4px;
  background: var(--dark);
  border-radius: 40px;
  box-shadow: 0 8px 20px #073d4626;
}`],
[`.flavor-backdrop {
  position: absolute;
  width: 440px;
  max-width: 110%;
  height: auto;
  top: -43px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}`, `/* Teal disc inside three fading rings, drawn rather than downloaded. */
.flavor-backdrop {
  position: absolute;
  width: 440px;
  max-width: 110%;
  aspect-ratio: 1;
  top: -43px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle closest-side,
    #0e5b66 0,
    var(--dark) 67.4%,
    transparent 67.9% 72%,
    #073d4640 72.3% 72.9%,
    transparent 73.2% 80%,
    #073d462e 80.3% 80.9%,
    transparent 81.2% 88%,
    #073d461f 88.3% 88.9%,
    transparent 89.2%
  );
}`],
[`.flavor-feature-copy p {
  color: #e1eae5;`, `.flavor-feature-copy p {
  color: var(--stage-soft);`],
[`  font-size: 15px;
  border: 0;
  box-shadow: none;
}`, `  font-size: 15px;
  border: 0;
  box-shadow: 0 10px 22px #b97c1238;
}`],
[`  width: min(100% - 64px, 330px);
  background: transparent;
  color: #d8e4e0;`, `  width: min(100% - 64px, 330px);
  background: transparent;
  color: var(--stage-soft);`],
[`.flavor-neighbor:hover {
  transform: translateY(-5px);
  color: var(--cream);
}`, `.flavor-neighbor:hover {
  transform: translateY(-5px);
  color: var(--stage-ink);
}`],
[`  height: 200px;
  opacity: 0.75;`, `  height: 200px;
  opacity: 0.88;`],
[`  border: 1px solid #e2e8df80;
  border-radius: 50%;
  color: var(--gold);
  background: #003e48;`, `  border: 1px solid #073d4638;
  border-radius: 50%;
  color: var(--stage-ink);
  background: #fffdf8;`],
[`  scrollbar-color: #f3ca7370 transparent;`, `  scrollbar-color: #073d4640 transparent;`],
[`  background: transparent;
  color: var(--cream);
  padding: 3px 14px;
  border-inline-end: 1px solid #ffffff14;`, `  background: transparent;
  color: var(--stage-soft);
  padding: 3px 14px;
  border-inline-end: 1px solid var(--stage-line);`],
[`.flavor-thumbnail:hover .flavor-thumbnail-art {
  border-color: #f3ca7360;
}
.flavor-thumbnail.is-active .flavor-thumbnail-art {
  border-color: var(--gold);
}
.flavor-thumbnail:hover .flavor-thumbnail-copy,
.flavor-thumbnail.is-active .flavor-thumbnail-copy {
  color: var(--gold);
}`, `.flavor-thumbnail:hover .flavor-thumbnail-art {
  border-color: #f3ca7399;
}
.flavor-thumbnail.is-active .flavor-thumbnail-art {
  border-color: var(--gold);
  background: #f3ca7333;
}
.flavor-thumbnail:hover .flavor-thumbnail-copy,
.flavor-thumbnail.is-active .flavor-thumbnail-copy {
  color: var(--stage-ink);
}`],
[`.mezze-strip {
  background: var(--cream);
  border-bottom: 1px solid var(--line);
}`, `.mezze-strip {
  background: #003e48;
  color: var(--cream);
}`],
[`  margin-top: 10px;
  color: var(--muted);
  max-width: 30ch;
}
.mezze-strip-rays {
  position: absolute;
  top: 0;
  inset-inline-start: -8px;
  color: #d2a84e;`, `  margin-top: 10px;
  color: #cfdcd8;
  max-width: 30ch;
}
.mezze-strip-rays {
  position: absolute;
  top: 0;
  inset-inline-start: -8px;
  color: var(--gold);`],
[`.mezze-strip-copy p {
  white-space: nowrap;
  font-size: 26px;
  margin-bottom: 12px;
}`, `.mezze-strip-copy p {
  white-space: nowrap;
  font-size: 26px;
  margin-bottom: 12px;
  color: var(--gold);
}`],
[`.mezze-strip-choose {
  background: #f1e6cc;`, `.mezze-strip-choose {
  background: #ffffff17;
  color: var(--cream);`],
[`.mezze-strip-choose:hover {
  background: var(--gold);
}`, `.mezze-strip-choose:hover {
  background: var(--gold);
  color: var(--dark);
}`],
[`    width: 40px;
    height: 40px;
    background: #003e48dd;`, `    width: 40px;
    height: 40px;
    background: #fffdf8e6;`],
];
for (const [a, b] of edits) {
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error("MATCH COUNT", n, "for:\n" + a); process.exit(1); }
  s = s.replace(a, b);
}
fs.writeFileSync(path, s);
console.log("applied", edits.length);
