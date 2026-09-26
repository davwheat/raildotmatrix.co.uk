const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const YAFF = require("./yaff.js");
const { fromYAFF, toYAFF, fromJSON } = require("./font-builder-yaff.js");

const directory = path.join(__dirname, "../led-board/internal/font/fonts");
const normalized = (font) => ({
  properties: { ...font.properties },
  comments: [...font.comments, ...font.glyphs.flatMap((g) => g.comments)].map((c) => c.text).sort(),
  glyphs: font.glyphs.map((g) => ({ labels: g.labels, rows: g.rows, properties: { ...g.properties } })),
});

for (const file of fs.readdirSync(directory).filter((file) => file.endsWith(".yaff"))) {
  test(`editor preserves ${file}`, () => {
    const bytes = fs.readFileSync(path.join(directory, file));
    const before = YAFF.parse(bytes);
    const editor = fromYAFF(bytes, file);
    assert.deepEqual(normalized(YAFF.parse(toYAFF(editor))), normalized(before));
  });
}

test("editing pixels preserves metadata, metrics and non-character glyphs", () => {
  const font = fromYAFF('yaff: 1.0\nname: Test\nnotice: "copyright"\nu+0041:\n0x41:\n"latin_a":\n    @.\n\n    right-bearing: 2\n"fallback":\n    @@\n\'ff\':\n    @.@\n:\n    -\n');
  font.glyphs.A.rows[0] = "01";
  const result = YAFF.parse(toYAFF(font));
  assert.equal(result.properties.notice, "copyright");
  assert.equal(result.glyphs[0].rows[0], ".@");
  assert.equal(result.glyphs[0].properties["right-bearing"], "2");
  assert.equal(result.glyphs[0].labels.length, 3);
  assert.equal(result.glyphs.length, 4);
});

test("new fonts and legacy imports export valid YAFF", () => {
  const fonts = fromJSON(JSON.stringify({ fonts: [{ name: "Old", glyphs: { "😀": { rows: ["01", "10"] } } }] }));
  const parsed = YAFF.parse(toYAFF(fonts[0]));
  assert.equal(parsed.glyphs[0].labels[0].value, "😀");
  assert.equal(parsed.properties["line-height"], "2");
  assert.equal(parsed.glyphs[0].rows[0], ".@");
  assert.throws(() => fromJSON('{"fonts":[{"name":"Bad","glyphs":{"A":{"rows":["1","00"]}}}]}'));
  assert.throws(() => fromYAFF("levels: 4\n'A':\n    12"), /monochrome/);
});

test("legacy YAFF keeps its version semantics when exported", () => {
  const font = fromYAFF("A:\n    @\n\n    tracking: 1\n");
  const parsed = YAFF.parse(toYAFF(font));
  assert.equal(parsed.properties.yaff, "0.1");
  assert.equal(parsed.glyphs[0].properties.tracking, "1");
});
