/* YAFF 1.0.4 parser and writer. MIT licensed; see LICENSE. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YAFF = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  class ParseError extends SyntaxError {
    constructor(message, line) {
      super(`YAFF line ${line}: ${message}`);
      this.name = "ParseError";
      this.line = line;
    }
  }
  const fail = (message, line) => { throw new ParseError(message, line); };
  const trim = (s) => s.replace(/^[ \t]+|[ \t]+$/g, "");
  const indent = (s) => /^[ \t]*/.exec(s)[0];
  const keyPattern = /^[a-zA-Z0-9_.-]+$/;
  const keyOf = (s) => s.toLowerCase().replace(/_/g, "-");
  const deprecatedGlobal = new Set(["average-advance", "max-advance", "cap-advance"]);
  const deprecatedGlyph = new Set(["offset", "tracking", "kern-to"]);

  function validateText(text) {
    let line = 1;
    for (let i = 0; i < text.length; i++) {
      const cp = text.codePointAt(i);
      if ((cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) ||
          (cp >= 0x7f && cp <= 0x9f) || (cp >= 0xd800 && cp <= 0xdfff) ||
          (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xffff) >= 0xfffe) {
        fail(`forbidden character U+${cp.toString(16).toUpperCase()}`, line);
      }
      if (cp === 10 || (cp === 13 && text[i + 1] !== "\n")) line++;
      if (cp > 0xffff) i++;
    }
  }

  // Parse quoted elements without splitting commas or colons inside the quotes.
  function characterLabel(source, line) {
    let i = 0, value = "";
    while (i < source.length) {
      while (source[i] === " " || source[i] === "\t") i++;
      if (source[i] === "'") {
        const start = ++i;
        // Quotes have no escaping. A closing quote is followed by a comma or EOF.
        while (i < source.length && !(source[i] === "'" && /^(?:[ \t]*,|[ \t]*$)/.test(source.slice(i + 1)))) i++;
        if (i === source.length) fail("unterminated character label", line);
        value += source.slice(start, i++);
      } else {
        const match = /^[uU]\+([0-9a-fA-F]+)/.exec(source.slice(i));
        if (!match) fail("expected a quoted character or u+ hexadecimal point", line);
        const point = Number.parseInt(match[1], 16);
        if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) fail("invalid Unicode scalar", line);
        value += String.fromCodePoint(point);
        i += match[0].length;
      }
      while (source[i] === " " || source[i] === "\t") i++;
      if (i === source.length) break;
      if (source[i++] !== "," || !trim(source.slice(i))) fail("invalid character sequence", line);
    }
    return { type: "character", value };
  }

  function parseLabel(source, { legacy = false, line = 1 } = {}) {
    source = trim(source);
    if (!source) return null;
    if (source.startsWith("'") || /^[uU]\+/.test(source)) return characterLabel(source, line);
    if (source.startsWith('"') && source.endsWith('"') && source.length >= 2) {
      return { type: "tag", value: source.slice(1, -1) };
    }
    if (/^[0-9]/.test(source)) {
      const parts = source.split(",").map(trim);
      const values = parts.map((part) => {
        if (!/^(?:[0-9]+|0[xX][0-9a-fA-F]+|0[oO][0-7]+)$/.test(part)) fail("invalid codepoint", line);
        return BigInt(part);
      });
      if (parts.length > 1) {
        if (values.some((value) => value > 255n)) fail("multi-byte codepoint elements must be below 256", line);
        return { type: "codepoint", value: values.map(Number) };
      }
      const hex = values[0].toString(16).padStart(2, "0");
      const padded = hex.length % 2 ? "0" + hex : hex;
      return { type: "codepoint", value: padded.match(/../g).map((byte) => Number.parseInt(byte, 16)) };
    }
    if (legacy) {
      if (source.codePointAt(0) > 127 || [...source].length === 1) return { type: "character", value: source };
      if (/^[a-zA-Z][a-zA-Z0-9_.-]+$/.test(source)) return { type: "tag", value: source };
    }
    fail("invalid or deprecated label", line);
  }

  function valueLine(source, line) {
    const value = trim(source);
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) return value.slice(1, -1);
    if (!value || /^[:.@]/.test(value) || value.endsWith(":") || value === "-") fail("invalid unquoted property value", line);
    return value;
  }

  function parse(input) {
    let text;
    if (typeof input === "string") text = input;
    else if (input instanceof Uint8Array) {
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(input); }
      catch { fail("invalid UTF-8", 1); }
    } else throw new TypeError("YAFF input must be a string or Uint8Array");
    validateText(text);
    if (text.startsWith("\ufeff")) text = text.slice(1);
    const lines = text.split(/\r\n|\r|\n/);
    const font = { properties: Object.create(null), comments: [], glyphs: [] };
    let i = 0, modern = false, levels = 2;

    const pixelPattern = () => levels === 256 ? /^(?:\.\.|@@|[0-9a-fA-F]{2})+$/ :
      levels === 16 ? /^[.@1-9a-eA-E]+$/ : levels === 4 ? /^[.@12]+$/ : /^[.@]+$/;
    const isRaster = (s) => s === "-" || pixelPattern().test(s);
    const trivia = (comments) => {
      let blank = false;
      while (i < lines.length) {
        if (!trim(lines[i])) { blank = true; i++; }
        else if (lines[i].startsWith("#")) {
          comments.push({ text: lines[i].slice(/^#[ \t]/.test(lines[i]) ? 2 : 1), line: i + 1 });
          i++;
        } else break;
      }
      return blank;
    };
    function property(target, base, glyph) {
      const line = i + 1;
      const body = lines[i].slice(base.length);
      const match = /^([a-zA-Z0-9_.-]+)[ \t]*:(.*)$/.exec(body);
      if (!match) fail("expected a property", line);
      const key = keyOf(match[1]);
      if (modern && (glyph ? deprecatedGlyph : deprecatedGlobal).has(key)) fail("deprecated property in YAFF 1.0+", line);
      i++;
      let value;
      if (trim(match[2])) value = valueLine(match[2], line);
      else {
        const values = [];
        while (i < lines.length && indent(lines[i]).startsWith(base) && indent(lines[i]).length > base.length && trim(lines[i])) {
          values.push(valueLine(lines[i], i + 1));
          i++;
        }
        if (!values.length) fail("missing property value", line);
        value = values.join("\n");
      }
      target[key] = value;
      if (!glyph && key === "yaff") {
        if (!/^\d+\.\d+(?:\.\d+)?$/.test(value)) fail("invalid YAFF version", line);
        modern = Number(value.split(".")[0]) >= 1;
        if (modern && Object.keys(target).some((key) => deprecatedGlobal.has(key))) fail("deprecated property in YAFF 1.0+", line);
      }
      if (!glyph && key === "levels") {
        if (!["2", "4", "16", "256"].includes(value)) fail("levels must be 2, 4, 16 or 256", line);
        levels = Number(value);
      }
    }

    while (i < lines.length) {
      trivia(font.glyphs.at(-1)?.comments ?? font.comments);
      if (i === lines.length) break;
      if (indent(lines[i])) fail("unexpected indentation", i + 1);
      const header = trim(lines[i]);
      const propertyMatch = /^([a-zA-Z0-9_.-]+)[ \t]*:(.*)$/.exec(header);
      // A key with a following indented non-raster value is a multiline property.
      const next = lines[i + 1] ?? "";
      const multilineProperty = indent(next) && trim(next) && !isRaster(trim(next));
      const propertyOnly = (modern || levels !== 2) && !/^[0-9]/.test(header);
      if (propertyMatch && (trim(propertyMatch[2]) || multilineProperty || propertyOnly)) {
        if (font.glyphs.length) fail("font properties must precede glyphs", i + 1);
        property(font.properties, "", false);
        continue;
      }
      const glyph = { labels: [], rows: [], properties: Object.create(null), comments: [], line: i + 1 };
      const labelTypes = new Set();
      let unlabelled = false;
      while (i < lines.length && !indent(lines[i])) {
        const header = trim(lines[i]);
        if (!header.endsWith(":")) fail("expected a label ending in a colon", i + 1);
        const label = parseLabel(header.slice(0, -1), { legacy: !modern && levels === 2, line: i + 1 });
        if (!label && (glyph.labels.length || unlabelled)) fail("empty label cannot be combined with other labels", i + 1);
        if (label) {
          if (unlabelled) fail("empty label cannot be combined with other labels", i + 1);
          if ((modern || levels !== 2) && labelTypes.has(label.type)) fail("multiple labels of the same type in YAFF 1.0+", i + 1);
          labelTypes.add(label.type);
          glyph.labels.push(label);
        } else unlabelled = true;
        i++;
        trivia(glyph.comments);
      }
      if (i >= lines.length) fail("label without a glyph", glyph.line);
      const base = indent(lines[i]);
      let width = -1, empty = false;
      while (i < lines.length && trim(lines[i])) {
        if (lines[i].startsWith("#")) {
          glyph.comments.push({ text: lines[i].slice(/^#[ \t]/.test(lines[i]) ? 2 : 1), line: i + 1 });
          i++;
          continue;
        }
        if (!indent(lines[i])) break;
        if (indent(lines[i]) !== base) fail("inconsistent glyph indentation", i + 1);
        const row = trim(lines[i]);
        if (!isRaster(row)) fail("invalid pixels or missing blank line before glyph properties", i + 1);
        if (empty || (row === "-" && glyph.rows.length)) fail("empty glyph must contain only '-'", i + 1);
        if (row === "-") empty = true;
        else {
          if (width >= 0 && row.length !== width) fail("unequal glyph row widths", i + 1);
          if (levels === 256 && row.match(/../g).some((pixel) => /^(?:00|ff)$/i.test(pixel))) fail("use '..' and '@@' for the end levels", i + 1);
          width = row.length;
          glyph.rows.push(row);
        }
        i++;
      }
      if (!empty && !glyph.rows.length) fail("missing glyph pixels", i + 1);
      glyph.width = Math.max(0, width) / (levels === 256 ? 2 : 1);
      glyph.height = glyph.rows.length;
      let blank = trivia(glyph.comments);
      while (i < lines.length && indent(lines[i])) {
        if (!blank) fail("glyph properties need a preceding blank line", i + 1);
        if (indent(lines[i]) !== base) fail("glyph property indentation differs from raster", i + 1);
        property(glyph.properties, base, true);
        trivia(glyph.comments);
      }
      font.glyphs.push(glyph);
    }
    return font;
  }

  function formatLabel(label) {
    if (label.type === "character") return [...label.value].map((ch) => "u+" + ch.codePointAt(0).toString(16).padStart(4, "0")).join(", ") || "''";
    if (label.type === "tag") return '"' + label.value + '"';
    if (label.type === "codepoint" && label.value.length) return label.value.map((byte) => "0x" + byte.toString(16).padStart(2, "0")).join(", ");
    throw new TypeError("Invalid YAFF label");
  }

  function stringify(font) {
    const out = [];
    const comments = (list = []) => list.forEach((comment) => out.push("# " + comment.text));
    const properties = (props = {}, base = "") => {
      for (const [key, value] of Object.entries(props)) {
        if (!keyPattern.test(key)) throw new TypeError(`Invalid property key: ${key}`);
        if (typeof value !== "string") throw new TypeError(`Property ${key} must be a string`);
        // Quoting every value line also preserves empty lines and significant spaces.
        const lines = value.split("\n").map((line) => '"' + line + '"');
        if (lines.length === 1) out.push(`${base}${key}: ${lines[0]}`);
        else out.push(`${base}${key}:`, ...lines.map((line) => base + "    " + line));
      }
    };
    comments(font.comments);
    properties(font.properties);
    for (const glyph of font.glyphs) {
      out.push("");
      comments(glyph.comments);
      out.push(...(glyph.labels.length ? glyph.labels.map((label) => formatLabel(label) + ":") : [":"]));
      out.push(...(glyph.rows.length ? glyph.rows : ["-"]).map((row) => "    " + row));
      if (Object.keys(glyph.properties ?? {}).length) {
        out.push("");
        properties(glyph.properties, "    ");
      }
    }
    const text = out.join("\n") + (out.length ? "\n" : "");
    parse(text); // Reject invalid caller-created structures instead of writing corrupt files.
    return text;
  }

  // Indexes are optional: parsing alone does not allocate lookup maps or pixel arrays.
  function index(font) {
    const result = { characters: new Map(), codepoints: new Map(), tags: new Map() };
    for (const glyph of font.glyphs) for (const label of glyph.labels) {
      if (label.type === "character") result.characters.set(label.value, glyph);
      else if (label.type === "tag") result.tags.set(label.value, glyph);
      else result.codepoints.set(label.value.map((byte) => byte.toString(16).padStart(2, "0")).join(""), glyph);
    }
    return result;
  }

  function metric(font, glyph, key) {
    key = keyOf(key);
    const read = (value = "0") => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) throw new TypeError(`Invalid numeric metric ${key}: ${value}`);
      return Number(value);
    };
    return read(font.properties[key]) + read(glyph.properties[key]);
  }

  return { parse, stringify, parseLabel, formatLabel, index, metric, ParseError };
});
