// YAFF persistence for the browser editor. The board uses the standalone Go parser.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./yaff.js"));
  else root.FontBuilderYAFF = factory(root.YAFF);
})(globalThis, function (YAFF) {
  "use strict";

  function fromYAFF(input, filename = "Imported font") {
    const source = YAFF.parse(input);
    if (Number(source.properties.levels ?? 2) !== 2) throw new Error("The editor supports monochrome fonts only.");
    const font = { name: source.properties.name ?? filename.replace(/\.yaff$/i, ""), glyphs: {}, properties: source.properties, comments: source.comments, extraGlyphs: [] };
    for (const glyph of source.glyphs) {
      const characters = glyph.labels.filter((label) => label.type === "character");
      if (characters.length !== 1 || [...characters[0].value].length !== 1) {
        // Keep tags, codepage-only glyphs and graphemes even though the UI edits single characters.
        font.extraGlyphs.push(glyph);
        continue;
      }
      const ch = characters[0].value;
      if (Object.hasOwn(font.glyphs, ch)) throw new Error(`Duplicate glyph for ${ch}.`);
      font.glyphs[ch] = { rows: glyph.rows.map((row) => row.replaceAll(".", "0").replaceAll("@", "1")), yaff: glyph };
    }
    return font;
  }

  function toYAFF(font) {
    const height = Math.max(1, ...Object.values(font.glyphs).map((g) => g.rows.length));
    const properties = {
      yaff: font.properties ? (font.properties.yaff ?? "0.1") : "1.0",
      encoding: "unicode", "line-height": String(height), ascent: String(height),
      descent: "0", "shift-up": "0", "right-bearing": "1", ...font.properties, name: font.name,
    };
    const glyphs = Object.keys(font.glyphs).sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).map((ch) => {
      const g = font.glyphs[ch];
      const original = g.yaff ?? { labels: [{ type: "character", value: ch }], properties: {}, comments: [] };
      return {
        ...original,
        labels: original.labels.map((label) => label.type === "character" ? { ...label, value: ch } : label),
        rows: g.rows.map((row) => row.replaceAll("0", ".").replaceAll("1", "@")),
      };
    });
    glyphs.push(...(font.extraGlyphs ?? []));
    return YAFF.stringify({ properties, comments: font.comments ?? [], glyphs });
  }

  // Retain import of old editor exports so existing work can be migrated.
  function fromJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.fonts) || !data.fonts.length) throw new Error("Expected a nonempty fonts array.");
    return data.fonts.map((font) => {
      if (typeof font.name !== "string" || !font.glyphs || typeof font.glyphs !== "object") throw new Error("Invalid legacy font.");
      const glyphs = {};
      for (const [ch, glyph] of Object.entries(font.glyphs)) {
        if ([...ch].length !== 1 || !Array.isArray(glyph.rows) || glyph.rows.some((row) => typeof row !== "string" || !/^[01]+$/.test(row) || row.length !== glyph.rows[0].length)) throw new Error(`Invalid legacy glyph ${ch}.`);
        glyphs[ch] = { rows: glyph.rows, src: glyph.src };
      }
      return { name: font.name, glyphs };
    });
  }

  return { fromYAFF, toYAFF, fromJSON };
});
