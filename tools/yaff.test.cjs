const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse, stringify, index, metric, parseLabel, ParseError } = require("./yaff.js");

const glyph = (label = "u+0041", rows = "    .@\n    @@") => `${label}:\n${rows}\n`;
const modern = "yaff: 1.0\n";

test("parses the complete specification example", () => {
  const spec = fs.readFileSync(path.join(__dirname, "../led-board/third_party/yaff/SPECIFICATION.md"), "utf8");
  const example = spec.split("    # This is a global comment")[1].split("\nSpecification")[0];
  const source = "# This is a global comment" + example.replace(/^    /gm, "");
  const font = parse(source);
  assert.equal(font.glyphs.length, 9);
  assert.equal(font.properties.notice, "Test is the property of T€$ţ0Яζ Inc.\nIt's not a very useful font.");
  assert.equal(index(font).characters.get("ff").width, 5);
  assert.equal(index(font).tags.get("empty").height, 0);
  assert.equal(font.glyphs.at(-1).labels.length, 0);
});

test("empty files, BOM, CR, LF, CRLF, UTF-8 and final unterminated lines", () => {
  assert.equal(parse("").glyphs.length, 0);
  for (const newline of ["\n", "\r", "\r\n"]) {
    const source = "\ufeff" + (modern + glyph("'安'", "\t.@  \n\t@@\t")).replace(/\n/g, newline).trimEnd();
    assert.equal(index(parse(Buffer.from(source))).characters.get("安").height, 2);
  }
});

test("property normalization, multiline and quoted values", () => {
  const font = parse('LEFT_BEARING : -2\nnotice:\n\tone\n  " two "\n  ""\n  ".@:"\n  "-"\ncustom.value: "a: # b"\n' + glyph());
  assert.equal(font.properties["left-bearing"], "-2");
  assert.equal(font.properties.notice, "one\n two \n\n.@:\n-");
  assert.equal(font.properties["custom.value"], "a: # b");
});

test("comments strip exactly one whitespace and survive serialization", () => {
  const font = parse('# first\n#  second\n#\t third\n' + modern + '# label\n' + glyph() + '# trailing\n');
  const texts = (f) => [...f.comments, ...f.glyphs.flatMap((g) => g.comments)].map((c) => c.text);
  assert.deepEqual(texts(font), ["first", " second", " third", "label", "trailing"]);
  assert.deepEqual(texts(parse(stringify(font))), texts(font));
});

test("all label types, embedded separators and supplementary Unicode", () => {
  const source = modern + "u+0061, 'b,c', U+1F600:\n0x01, 0X20:\n\"a:b, C\":\n    @\n\n    right-bearing: -1\n";
  const font = parse(source), maps = index(font);
  assert.equal(maps.characters.get("ab,c😀"), font.glyphs[0]);
  assert.equal(maps.codepoints.get("0120"), font.glyphs[0]);
  assert.equal(maps.tags.get("a:b, C"), font.glyphs[0]);
  assert.deepEqual(parseLabel("'''"), { type: "character", value: "'" });
  assert.deepEqual(parseLabel("','"), { type: "character", value: "," });
  assert.deepEqual(parseLabel("'a'b'"), { type: "character", value: "a'b" });
  assert.deepEqual(parseLabel("'a', 'b'"), { type: "character", value: "ab" });
});

test("codepoints have arbitrary precision, decimal leading zeros and big endian byte sequences", () => {
  for (const source of ["288", "00288", "0x120", "0X120", "0o440", "0O440", "1, 32"]) {
    assert.deepEqual(parseLabel(source).value, [1, 32]);
  }
  assert.deepEqual(parseLabel("0x10000000000000001").value, [1, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(parseLabel("0, 1").value, [0, 1]);
});

test("empty and unlabelled glyphs", () => {
  const font = parse(modern + glyph('"empty"', "    -") + glyph(""));
  assert.deepEqual(font.glyphs[0].rows, []);
  assert.equal(font.glyphs[0].width, 0);
  assert.deepEqual(font.glyphs[1].labels, []);
});

test("comments between pixels and greyscale-looking multiline properties", () => {
  const font = parse('levels: 16\nnotice:\n    BEEF\n\'A\':\n    .@\n# between rows\n    @.\n# before blank\n\n    right-bearing: 1\n');
  assert.equal(font.properties.notice, "BEEF");
  assert.equal(font.glyphs[0].rows.length, 2);
  assert.equal(font.glyphs[0].comments.length, 2);
});

test("font and glyph metrics add; arbitrary properties and paths are retained", () => {
  const font = parse(modern + 'left-bearing: -2\n' + glyph() + '\n    LEFT_BEARING: 1.5\n    right-kerning:\n        u+0056 -2\n        "foo" 1\n    path: m 1 2 l -1 -2\n');
  assert.equal(metric(font, font.glyphs[0], "left_bearing"), -0.5);
  assert.equal(metric(font, font.glyphs[0], "shift-up"), 0);
  assert.equal(font.glyphs[0].properties["right-kerning"], 'u+0056 -2\n"foo" 1');
  assert.equal(font.glyphs[0].properties.path, "m 1 2 l -1 -2");
});

test("legacy labels, repeated label types and properties", () => {
  const font = parse('yaff: 0.1\naverage-advance: 3\nA:\nÀ:\nlatin_a:\n    @\n\n    tracking: 2\n');
  assert.equal(font.glyphs[0].labels.length, 3);
  assert.equal(font.glyphs[0].properties.tracking, "2");
  assert.equal(parse(glyph("ते")).glyphs[0].labels[0].value, "ते");
});

for (const [levels, rows, width] of [[2, ".@", 2], [4, ".12@", 4], [16, ".123456789aBcDE@", 16], [256, "..010FF0FE@@", 6]]) {
  test(`${levels} greyscale levels`, () => {
    const font = parse(modern + `levels: ${levels}\n` + glyph("'A'", "    " + rows));
    assert.equal(font.glyphs[0].width, width);
    assert.equal(parse(stringify(font)).glyphs[0].rows[0], rows);
  });
}

const invalid = [
  ["control character", "name: a\x00b"], ["DEL", "# \x7f"], ["C1", "# \x85"],
  ["noncharacter", "# \ufdd0"], ["plane noncharacter", "# \u{1ffff}"],
  ["unpaired surrogate", "# \ud800"], ["non-UTF-8 bytes", Buffer.from([0xc0, 0x80])],
  ["bare CR in value", "name: hi\rthere"], ["inline comment on label", "'A': # hi\n    @"],
  ["indent on comment", "  # hi"], ["indent on global property", "  name: hi"],
  ["invalid key", "hello world: a"], ["missing property value", "name:"],
  ["blank before property value", "name:\n\n    text"], ["colon starts value", "name: :oops"],
  ["dot starts value", "name: .oops"], ["ink starts value", "name: @oops"],
  ["colon ends value", "name: oops:"], ["dash value", "name: -"],
  ["font property after glyph", glyph() + "name: late"],
  ["empty element", glyph("u+0041," )], 
  ["invalid Unicode", glyph("u+110000")], ["surrogate Unicode", glyph("u+d800")],
  ["invalid codepoint", glyph("0xGG")], ["invalid octal", glyph("0o89")],
  ["large byte", glyph("0, 256")], ["negative codepoint", glyph("-1")],
  ["modern bare label", modern + glyph("A")], ["modern bare tag", modern + glyph("latin_a")],
  ["duplicate label type", modern + "'A':\nu+0042:\n    @"],
  ["modern glyph property", modern + glyph() + "\n    offset: 1 2"],
  ["modern global property", modern + "max-advance: 2"],
  ["late modern signature", "max-advance: 2\n" + modern],
  ["label missing raster", "'A':"], ["unindented raster", glyph("'A'", "@@")],
  ["unequal rows", glyph("'A'", "    @\n    @@")],
  ["unequal indent", glyph("'A'", "    @\n\t@")],
  ["internal whitespace", glyph("'A'", "    @ @")],
  ["bad pixels", glyph("'A'", "    #.")],
  ["empty mixed with raster", glyph("'A'", "    -\n    @")],
  ["repeated empty", glyph("'A'", "    -\n    -")],
  ["missing glyph property blank", glyph() + "    left-bearing: 2"],
  ["wrong property indent", glyph() + "\n  left-bearing: 2"],
  ["invalid levels", "levels: 8\n" + glyph()],
  ["invalid grey", "levels: 4\n" + glyph("'A'", "    3")],
  ["grey deprecated labels", "levels: 4\n" + glyph("A", "    .12")],
  ["odd grey row", "levels: 256\n" + glyph("'A'", "    ..@")],
  ["grey zero alias", "levels: 256\n" + glyph("'A'", "    00")],
  ["grey full alias", "levels: 256\n" + glyph("'A'", "    FF")],
  ["combined empty label", modern + ":\n'A':\n    @"],
];
for (const [name, source] of invalid) test(`rejects ${name}`, () => assert.throws(() => parse(source), ParseError));

test("errors carry original line numbers", () => {
  assert.throws(() => parse("# hi\r\n\r\n'A':\r\n    @\r\n    @@"), (error) => error.line === 5);
});

test("round trip retains labels, pixels, metadata, comments and metrics", () => {
  const source = '# font\n' + modern + 'name: " .font: "\n' + glyph("u+1f600") + '\n    custom.note: "#yes"\n';
  const once = stringify(parse(source));
  assert.equal(stringify(parse(once)), once);
});

test("property names cannot mutate prototypes", () => {
  const font = parse("constructor: text\n__proto__: safe\n");
  assert.equal(font.properties.constructor, "text");
  assert.equal(font.properties["--proto--"], "safe");
  assert.equal(Object.getPrototypeOf(font.properties), null);
});
