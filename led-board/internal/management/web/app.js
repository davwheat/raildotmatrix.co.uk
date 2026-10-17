"use strict";
const $ = (id) => document.getElementById(id);
let snapshot,
  sshSnapshot,
  sshDirty = false,
  sshBusy = false,
  updateDirty = false,
  updateTimer,
  commitsFor,
  dirty = false,
  switching = false,
  countryLoaded = false,
  statusRequests = 0,
  poll,
  session = { authenticated: false },
  loaded = false,
  currentTab,
  currentStep,
  patternShown = false,
  colourSeen = "";
const tabs = ["board", "network", "device", "updates", "developer"];
const setupSteps = ["panels", "colours", "station", "wifi"];
async function api(path, method = "GET", body) {
  const response = await fetch("/api/" + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(40000),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "login") signedOut();
    throw new Error(data.error || "The board could not complete this request.");
  }
  return data;
}
function notice(message, type = "") {
  $("notice").textContent = message;
  $("notice").className = "notice " + type;
  $("notice").hidden = !message;
}
function signedOut() {
  clearInterval(poll);
  previewHandle?.close();
  previewHandle = previewKey = undefined;
  session = { authenticated: false };
  loaded = false;
  currentTab = currentStep = undefined;
  sshSnapshot = undefined;
  sshDirty = false;
  $("ssh-form").reset();
  $("ssh-keys").disabled = true;
  $("ssh-save").disabled = true;
  notice("");
  $("login").hidden = false;
  $("app").hidden = true;
  $("setup").hidden = true;
}
// Settings and status are loaded once the password is no longer the default,
// because until then the board refuses every other request.
async function load() {
  if (loaded) return true;
  loaded = true;
  try {
    await loadConfig();
    await status();
    clearInterval(poll);
    poll = setInterval(pollStatus, 5000);
    void loadUpdates();
    return true;
  } catch (error) {
    loaded = false;
    notice(error.message + " Reload the page to try again.", "error");
    return false;
  }
}
function navigate(path, replace = false) {
  if (location.pathname !== path)
    history[replace ? "replaceState" : "pushState"](null, "", path);
  return render();
}
window.addEventListener("popstate", () => void render());
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='/']");
  if (
    !link ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
});
async function render() {
  if (!session.authenticated) return signedOut();
  const [, section, step] = location.pathname.split("/");
  if (session.passwordChangeRequired) {
    if (section !== "setup" || step !== "password")
      return navigate("/setup/password", true);
    return showSetup("password");
  }
  if (section === "setup" && setupSteps.includes(step))
    return (await load()) && showSetup(step);
  if (session.setupStep !== "done")
    return navigate("/setup/" + session.setupStep, true);
  if (!tabs.includes(section)) return navigate("/board", true);
  if (await load()) showTab(section);
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await api("login", "POST", { password: $("login-password").value });
    $("login-error").textContent = "";
    $("login-password").value = "";
    session = await api("session");
    await render();
  } catch (error) {
    $("login-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
$("logout").onclick = async () => {
  try {
    await api("logout", "POST", {});
    signedOut();
  } catch (error) {
    notice(error.message, "error");
  }
};
const labels = {
  crs: "Station code",
  board: "Board style",
  colour: "Text colour",
  platforms: "Platforms to show",
  loading_brightness: "Loading fill brightness (%)",
  formation_count: "Formation count",
  coach_letter_tocs: "TOCs with coach letters",
  formation_icons: "Enabled formation icons",
  clock_style: "Clock style",
  ordinal_format: "Ordinal format",
  service_count: "Services to show (1–6)",
  row_prefix: "Row prefix",
  show_unconfirmed_platforms: "Show unconfirmed platforms",
  hide_terminating: "Hide terminating trains",
  warning_platform: "Name platforms in warnings",
  align_platform_rows: "Align lower service rows with platform box",
  service_separator: "Line between the first and later trains",
  compact_lower_row: "Show lower service row beside clock",
  platform_box: "Infotec platform box",
  worldline: "Worldline display style",
  page_destinations: "Page dividing trains' destinations",
  reserve_etd_column: 'Reserve space for "Cancelled"',
  clear_down_warning_to_cis: "Clear down warnings when no trains follow",
  legacy_toc_names: "Use historic operator names",
  scroll_speed: "Scroll speed (dots / second)",
  small_scrolling_text: "Use smaller scrolling text",
  ampersand_calling_points: 'Use "&" in calling points',
  url: "Live departure feed",
  fixture: "Example departure board",
  fps: "Animation rate (frames / second)",
  display: "Display output",
  png_dir: "PNG output directory",
  scale: "Preview scale",
  verbose: "Detailed logging",
  "led.rows": "Rows per panel",
  "led.cols": "Columns per panel",
  "led.chain": "Panels in each chain",
  "led.parallel": "Parallel chains",
  "led.brightness": "Brightness (%)",
  "led.rgb_sequence": "Panel colour order",
  "led.gpio_mapping": "Adapter wiring",
  "led.slowdown_gpio": "GPIO slowdown",
  "led.pwm_bits": "PWM bit depth",
  "led.limit_refresh": "Refresh limit (Hz)",
  "led.pwm_lsb_nanoseconds": "PWM pulse length (ns)",
  "led.pwm_dither_bits": "PWM dithering bits",
  "led.row_addr_type": "Row addressing",
  "led.multiplexing": "Multiplexing",
  "led.scan_mode": "Scan mode",
  "led.no_hardware_pulse": "Disable hardware pulse",
  "led.no_busy_waiting": "Sleep between refreshes",
  "led.no_drop_privs": "Keep root privileges",
  "led.show_refresh": "Log panel refresh rate",
};
const helpText = {
  crs: "Three-letter CRS code, e.g. BTN for Brighton.",
  platforms:
    "Separate platform numbers with commas. Leave empty for all platforms.",
  "led.rows": "The height of one panel, in dots.",
  "led.cols": "The width of one panel, in dots.",
  "led.chain":
    "How many panels are connected one after another to the adapter.",
  "led.parallel":
    "How many of the adapter's outputs have panels connected. Most boards use 1.",
  "led.gpio_mapping":
    "Most adapters use regular. For an Adafruit HAT or Bonnet, choose adafruit-hat.",
  "led.slowdown_gpio":
    "From 0 to 4. Increase it if the picture flickers or shows random dots.",
  "led.brightness": "From 1 to 100.",
  "led.rgb_sequence":
    "To find the right order, use Identify the colour order, which asks what the board shows.",
  row_prefix: "What the board shows before each train's time.",
  platform_box: "Shows the first train's platform in a box beside it.",
  compact_lower_row: "Applies when the board shows the platform box.",
  align_platform_rows: "Applies when the board shows the platform box.",
  service_separator:
    "The dim line that separates the first train from the trains after it.",
  formation_count:
    "If the words don't fit, the board shows the number in brackets.",
  loading_brightness:
    "How brightly the board fills each coach to show how busy it is.",
  small_scrolling_text: "The font for calling points and service information.",
  ampersand_calling_points: "How the board joins the last two calling points.",
  worldline:
    "A Worldline-driven board has one scrolling information line, and shows place names in capitals.",
  reserve_etd_column:
    'Whether a destination can use the space beside a time that "Cancelled" needs.',
  warning_platform: "What stand clear and not-for-public-use warnings name.",
};
const nice = {
  daktronics: "Daktronics Data Display",
  infotec: "Infotec landscape",
  amber: "Amber",
  white: "White",
  ordinals: "Ordinals",
  platforms: "Platform numbers",
  matrix: "LED matrix",
  png: "PNG images",
  window: "Desktop window",
  none: "Nothing",
  number: "(n)",
  coaches: "(n coaches)",
  "coaches-no-brackets": "n coaches",
  carriages: "(n carriages)",
  "carriages-no-brackets": "n carriages",
};
// optionLabels names the options that a visual setting shows as pictures of the board.
const optionLabels = {
  clock_style: {
    normal: "Large",
    "small-seconds": "Small seconds",
    small: "Small",
  },
  formation_count: {
    none: "No count",
    number: "(8)",
    coaches: "(8 coaches)",
    "coaches-no-brackets": "8 coaches",
    carriages: "(8 carriages)",
    "carriages-no-brackets": "8 carriages",
  },
  loading_brightness: {
    50: "Half brightness",
    75: "Three-quarter brightness",
    100: "Full brightness",
  },
  ordinal_format: { suffix: "1st, 2nd", dot: "1., 2." },
  row_prefix: { ordinals: "Order", platforms: "Platform" },
  platform_box: { false: "No box", true: "Platform box" },
  compact_lower_row: { false: "Clock below", true: "Clock beside" },
  align_platform_rows: { false: "Not aligned", true: "Aligned" },
  service_separator: { false: "No line", true: "Line" },
  small_scrolling_text: { false: "Regular", true: "Smaller" },
  ampersand_calling_points: { false: "“and”", true: "“&”" },
  worldline: { false: "Standard", true: "Worldline" },
  reserve_etd_column: { false: "Use the space", true: "Keep it clear" },
  warning_platform: { false: "This station", true: "Platform number" },
};
// scenes are the examples that show each visual setting: a fixture from internal/fixtures, and the times into it, in
// milliseconds, in order. The first time that the options look different is shown, or, with focus "start", the time
// that the first difference is nearest the middle, and the pictures centre on it. Without a time, a board is shown
// once it settles.
const scenes = {
  board: {},
  colour: {},
  row_prefix: {},
  ordinal_format: {},
  // With no trains, only the clock changes, wherever the layout puts it.
  clock_style: { fixture: "no-departures" },
  platform_box: {},
  compact_lower_row: {},
  align_platform_rows: {},
  service_separator: {},
  formation_count: { fixture: "detailed-formation" },
  // The formation's pages take turns every five seconds, and which come first depends on the other settings.
  loading_brightness: {
    fixture: "detailed-formation",
    at: [4000, 9000, 14000, 19000],
  },
  small_scrolling_text: { at: [11000] },
  // The calling points scroll, so the board is shown when the "and" or "&" is near the middle of the row.
  ampersand_calling_points: {
    at: Array.from({ length: 81 }, (_, i) => 8000 + i * 250),
    focus: "start",
  },
  worldline: {},
  reserve_etd_column: { fixture: "triple-line" },
  warning_platform: { fixture: "stand-clear" },
};
const previewFixtures = {
  "busy-board": "Several trains",
  delayed: "Delay",
  cancelled: "Cancellation",
  "dividing-service": "Dividing train",
  "stand-clear": "Platform warning",
  "detailed-formation": "Coach formation",
  "first-departs": "Departure",
  "no-departures": "No trains",
};
const groups = [
  [
    "Station",
    "Leave the station empty to show setup instructions.",
    "crs platforms service_count show_unconfirmed_platforms hide_terminating legacy_toc_names",
  ],
  [
    "Appearance",
    "Each option shows the example board with your other settings. Settings that don't change the board you've chosen are hidden.",
    "board colour row_prefix ordinal_format clock_style platform_box compact_lower_row align_platform_rows service_separator formation_count loading_brightness small_scrolling_text ampersand_calling_points worldline reserve_etd_column warning_platform",
  ],
  [
    "More display options",
    "",
    "coach_letter_tocs formation_icons scroll_speed page_destinations clear_down_warning_to_cis",
  ],
  [
    "LED panels",
    "Panel dimensions and adapter wiring.",
    "led.rows led.cols led.chain led.parallel led.brightness led.rgb_sequence led.gpio_mapping led.slowdown_gpio",
  ],
];
function get(values, key) {
  return key.split(".").reduce((v, k) => v?.[k], values);
}
function set(values, key, value) {
  const keys = key.split(".");
  if (keys.length === 2) {
    values[keys[0]] ??= {};
    values[keys[0]][keys[1]] = value;
  } else values[key] = value;
}
function unset(values, key) {
  const keys = key.split(".");
  if (keys.length === 2) delete values[keys[0]]?.[keys[1]];
  else delete values[key];
}
function optionLabel(key, value) {
  return optionLabels[key]?.[value] ?? nice[value] ?? value;
}
function visualField(field, prefix) {
  const wrap = document.createElement("fieldset");
  wrap.className = "field visual";
  wrap.id = prefix + field.key;
  wrap.dataset.key = field.key;
  const legend = document.createElement("legend");
  legend.textContent = labels[field.key] || field.key.replaceAll("_", " ");
  const options = document.createElement("div");
  options.className = "options";
  const current = String(get(snapshot.values, field.key) ?? field.default);
  for (const value of field.type === "bool"
    ? ["false", "true"]
    : field.choices) {
    const option = document.createElement("label");
    option.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = wrap.id;
    input.value = value;
    input.checked = value === current;
    const dots = document.createElement("canvas");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    option.append(input, dots, text("span", optionLabel(field.key, value)));
    options.append(option);
  }
  const help = text("small", helpText[field.key] || "", "field-help");
  help.hidden = !helpText[field.key];
  const same = text(
    "small",
    "With your other settings, the example board looks the same with each option.",
    "field-help same",
  );
  same.hidden = true;
  wrap.append(legend, options, help, same);
  return wrap;
}
function field(field, prefix = "setting-") {
  const wrap = visualFor(field)
    ? visualField(field, prefix)
    : document.createElement("div");
  if (field.boards) wrap.dataset.boards = field.boards.join(" ");
  if (wrap.tagName === "FIELDSET") return wrap;
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = labels[field.key] || field.key.replaceAll("_", " ");
  label.htmlFor = prefix + field.key;
  let input;
  if (field.choices) {
    input = document.createElement("select");
    for (const choice of field.choices) {
      const opt = document.createElement("option");
      opt.value = choice;
      opt.textContent = nice[choice] || choice || "Live departures";
      input.append(opt);
    }
  } else {
    input = document.createElement("input");
    input.type =
      field.type === "bool"
        ? "checkbox"
        : field.type === "int"
          ? "number"
          : "text";
    if (input.type === "number") input.step = "1";
  }
  input.id = label.htmlFor;
  input.dataset.key = field.key;
  const current = get(snapshot.values, field.key),
    value = current ?? field.default;
  if (field.type === "bool") {
    input.checked = Boolean(value);
    label.className = "checkbox-label";
    label.prepend(input);
    wrap.append(label);
  } else {
    input.value =
      field.type === "stringSlice" ? (value || []).join(", ") : (value ?? "");
    wrap.append(label, input);
  }
  if (field.key === "crs") {
    input.maxLength = 3;
    input.placeholder = "e.g. BTN for Brighton";
    input.pattern = "[A-Za-z]{3}|";
    input.autocomplete = "off";
    input.addEventListener(
      "input",
      () => (input.value = input.value.toUpperCase()),
    );
  }
  if (field.key === "platforms")
    input.placeholder = "All platforms, or e.g. 1, 2, 3";
  if (field.automatic) {
    const autoLabel = document.createElement("label");
    autoLabel.className = "automatic";
    const auto = document.createElement("input");
    auto.type = "checkbox";
    auto.id = prefix + "auto-" + field.key;
    auto.checked = current === undefined;
    input.disabled = auto.checked;
    auto.onchange = () => (input.disabled = auto.checked);
    autoLabel.append(
      auto,
      document.createTextNode("Automatic — chosen by the board"),
    );
    wrap.append(autoLabel);
  }
  const help = document.createElement("small");
  help.className = "field-help";
  help.textContent = helpText[field.key] || field.help;
  wrap.append(help);
  return wrap;
}
async function loadConfig() {
  snapshot = await api("config");
  const container = $("config-fields");
  container.replaceChildren();
  const used = new Set();
  for (const [title, description, keys] of groups) {
    const card = document.createElement("section");
    card.className = "card config-section";
    const copy = document.createElement("div");
    copy.className = "section-copy";
    const h = document.createElement("h3");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = description;
    copy.append(h);
    if (description) copy.append(p);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    for (const key of keys.split(" ")) {
      const f = snapshot.fields.find((f) => f.key === key);
      if (f) {
        grid.append(field(f));
        used.add(key);
      }
    }
    if (title === "LED panels") {
      const identify = text("a", "Identify the colour order", "button quiet");
      identify.href = "/setup/colours";
      copy.append(identify);
    }
    card.append(copy, grid);
    container.append(card);
  }
  const advanced = document.createElement("details");
  advanced.className = "card advanced";
  const summary = document.createElement("summary");
  summary.textContent = "Advanced settings & diagnostics";
  const grid = document.createElement("div");
  grid.className = "field-grid";
  for (const f of snapshot.fields) if (!used.has(f.key)) grid.append(field(f));
  advanced.append(summary, grid);
  container.append(advanced);
  showRelevantFields(container, "setting-");
  showPreviewFixtures();
  schedulePreviews();
  dirty = false;
  $("save-status").textContent = get(snapshot.values, "crs")
    ? "No unsaved changes."
    : "Choose a station to start showing live departures.";
}
function choiceValue(f, value) {
  return f.type === "bool"
    ? value === "true"
    : f.type === "int"
      ? Number(value)
      : value;
}
// formValues returns every setting as the page shows it: the fields with this prefix, and the saved or default
// value of the rest.
function formValues(prefix) {
  const values = {};
  for (const f of snapshot.fields) {
    let value = get(snapshot.values, f.key) ?? f.default;
    if ($(prefix + f.key) && !f.automatic)
      try {
        value = inputValue(f, prefix);
      } catch {
        // A number that's still being typed keeps the saved value.
      }
    set(values, f.key, value);
  }
  return values;
}
// needs names the settings that only change the board when another setting is on.
const needs = {
  compact_lower_row: "platform_box",
  align_platform_rows: "platform_box",
};
// showRelevantFields hides the settings that don't change the board with the board style and settings chosen.
function showRelevantFields(container, prefix) {
  const values = formValues(prefix);
  for (const element of container.querySelectorAll("[data-key]")) {
    const wrap = element.closest(".field") ?? element;
    const boards = wrap.dataset.boards?.split(" ");
    wrap.hidden =
      Boolean(boards && !boards.includes(values.board)) ||
      (element.dataset.key in needs && !values[needs[element.dataset.key]]);
  }
}
// The live feed's settings don't change how an example looks, and verbose logging would fill the console.
const notPreviewed = new Set(["crs", "url", "fixture", "verbose", "led"]);
function boardOptions(values) {
  const options = {};
  for (const [key, value] of Object.entries(values))
    if (!notPreviewed.has(key))
      options[key.replace(/_(\w)/g, (_, c) => c.toUpperCase())] = value;
  options.width = values.led.cols * values.led.chain;
  options.height = values.led.rows * values.led.parallel;
  return options;
}
let previewTimer,
  previewGeneration = 0,
  previewFixture = "busy-board",
  previewHandle,
  previewKey,
  previewDots,
  previewLooping = false;
function schedulePreviews() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreviews, 120);
}
async function renderPreviews() {
  const generation = ++previewGeneration;
  let api;
  try {
    api = await boardPreview.load();
  } catch (error) {
    document.body.classList.add("no-previews");
    $("board-preview-status").textContent = error.message;
    return;
  }
  for (const [container, prefix] of [
    [$("config-fields"), "setting-"],
    [$("setup-station-fields"), "setup-"],
  ]) {
    if (!snapshot || container.closest("[hidden]")) continue;
    const values = formValues(prefix);
    if (prefix === "setting-") play(api, values);
    for (const fieldset of container.querySelectorAll("fieldset.visual")) {
      if (fieldset.hidden) continue;
      renderOptions(api, fieldset, values);
      // Each fieldset takes a few milliseconds, so the page answers input between them.
      await new Promise((resolve) => setTimeout(resolve));
      if (generation !== previewGeneration) return;
    }
  }
}
function renderOptions(api, fieldset, values) {
  const key = fieldset.dataset.key,
    scene = scenes[key];
  const f = snapshot.fields.find((f) => f.key === key);
  const inputs = [...fieldset.querySelectorAll("input")];
  const times = scene.at ?? [undefined];
  const lists = inputs.map((input) => {
    const variant = structuredClone(values);
    set(variant, key, choiceValue(f, input.value));
    // Each scene's times suit the default scroll speed, and a still can't show a speed anyway: at another speed, the
    // text that the picture is about might not have scrolled into view yet, or might have scrolled away.
    const result = api.render({
      ...boardOptions(variant),
      scrollSpeed: 0,
      fixture: scene.fixture ?? "busy-board",
      at: scene.at,
    });
    return result instanceof Error ? null : scene.at ? result : [result];
  });
  let chosen = 0,
    box = null;
  for (let i = 0; i < times.length; i++) {
    const drawn = lists.filter(Boolean).map((list) => list[i]);
    const difference = drawn.length > 1 && boardPreview.difference(drawn);
    if (!difference) continue;
    const middle = drawn[0].width / 2;
    if (
      !box ||
      (scene.focus === "start" &&
        Math.abs(difference.x - middle) < Math.abs(box.x - middle))
    ) {
      chosen = i;
      box = difference;
    }
    if (scene.focus !== "start") break;
  }
  const stills = lists.map((list) => list?.[chosen]);
  const first = stills.find(Boolean);
  if (box && scene.focus === "start") box = { ...box, x: box.x - 24, w: 48 };
  const crop =
    first && box && boardPreview.around(box, first.width, first.height);
  inputs.forEach((input, i) => {
    const canvas = input.nextElementSibling;
    canvas.hidden = !stills[i];
    if (!stills[i]) return;
    canvas.dots ??= new boardPreview.Dots(canvas, 4);
    canvas.dots.paint(stills[i], crop || undefined);
  });
  fieldset.querySelector(".same").hidden = Boolean(box) || !first;
}
function play(api, values) {
  const options = { ...boardOptions(values), fixture: previewFixture };
  const key = JSON.stringify(options);
  if (key === previewKey) return;
  previewKey = key;
  previewHandle?.close();
  previewHandle = undefined;
  const handle = api.create(options);
  if (handle instanceof Error) {
    $("board-preview-status").textContent =
      "The preview can't show these settings: " + handle.message;
    return;
  }
  previewHandle = handle;
  $("board-preview-status").textContent = "Example trains";
  previewDots ??= new boardPreview.Dots($("board-preview-canvas"));
  if (!previewLooping) {
    previewLooping = true;
    requestAnimationFrame(animatePreview);
  }
}
function animatePreview() {
  const handle = previewHandle;
  if (!handle) {
    previewLooping = false;
    return;
  }
  if (!$("board-page").hidden && !$("app").hidden && handle.tick(Date.now()))
    previewDots.paint(handle);
  requestAnimationFrame(animatePreview);
}
function showPreviewFixtures() {
  const group = $("board-preview-scenes");
  group.replaceChildren();
  for (const [name, title] of Object.entries(previewFixtures)) {
    const button = text("button", title, "scene");
    button.type = "button";
    button.setAttribute("aria-pressed", String(name === previewFixture));
    button.onclick = () => {
      previewFixture = name;
      for (const other of group.children)
        other.setAttribute("aria-pressed", String(other === button));
      schedulePreviews();
    };
    group.append(button);
  }
}
function visualFor(field) {
  return field.key in scenes && (field.choices || field.type === "bool");
}
function inputValue(f, prefix = "setting-") {
  const input = $(prefix + f.key);
  if (input.tagName === "FIELDSET")
    return choiceValue(
      f,
      input.querySelector("input:checked")?.value ?? String(f.default),
    );
  if (f.type === "int" && input.value === "")
    throw new Error("Enter a value for " + (labels[f.key] || f.key));
  return f.type === "bool"
    ? input.checked
    : f.type === "int"
      ? Number(input.value)
      : f.type === "stringSlice"
        ? input.value
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : input.value;
}
$("config-form").addEventListener("input", () => {
  dirty = true;
  $("save-status").textContent = "Unsaved changes";
  showRelevantFields($("config-fields"), "setting-");
  schedulePreviews();
});
$("config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("save");
  button.disabled = true;
  try {
    const values = structuredClone(snapshot.values);
    for (const f of snapshot.fields) {
      if (f.automatic && $("setting-auto-" + f.key).checked) {
        unset(values, f.key);
        continue;
      }
      set(values, f.key, inputValue(f));
    }
    const result = await api("config", "PUT", {
      values,
      revision: snapshot.revision,
    });
    snapshot.values = values;
    snapshot.revision = result.revision;
    dirty = false;
    $("save-status").textContent = "Saved.";
    notice(result.message, "success");
    await status();
  } catch (error) {
    notice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("reload").onclick = async () => {
  if (
    dirty &&
    !confirm("Discard your unsaved changes and reload the board settings?")
  )
    return;
  try {
    await loadConfig();
    notice("Settings reloaded.");
  } catch (error) {
    notice(error.message, "error");
  }
};
window.addEventListener("beforeunload", (event) => {
  if (dirty || sshDirty || updateDirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
function showTab(tab) {
  leaveSetup();
  $("login").hidden = true;
  $("app").hidden = false;
  if (tab === currentTab) return;
  currentTab = tab;
  for (const item of document.querySelectorAll("[data-tab]")) {
    const active = item.dataset.tab === tab;
    item.classList.toggle("selected", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
    $(item.dataset.tab + "-page").hidden = !active;
  }
  if (tab === "board") schedulePreviews();
  if (tab === "network") scan();
  if (tab === "developer" && !sshSnapshot) loadSSHKeys();
  if (tab === "updates") loadUpdates();
}
function sshControls(busy) {
  sshBusy = busy;
  $("ssh-keys").disabled = !sshSnapshot;
  $("ssh-keys").readOnly = busy;
  $("ssh-save").disabled = busy || !sshSnapshot || !sshDirty;
  $("ssh-reload").disabled = busy;
}
async function loadSSHKeys() {
  if (sshBusy) return;
  sshControls(true);
  $("ssh-save-status").textContent = "Loading SSH keys…";
  try {
    sshSnapshot = await api("ssh-keys");
    $("ssh-keys").value = sshSnapshot.keys;
    sshDirty = false;
    $("ssh-save-status").textContent = "No unsaved changes.";
  } catch (error) {
    $("ssh-save-status").textContent = "Could not reload SSH keys. Try again.";
    notice(error.message, "error");
  } finally {
    sshControls(false);
  }
}
const stepTitles = {
  password: "Change the board password",
  panels: "Set up the LED panels",
  colours: "Check the colours",
  station: "Choose a station",
  wifi: "Connect to Wi-Fi",
};
const stepNames = {
  password: "Password",
  panels: "Panels",
  colours: "Colours",
  station: "Station",
  wifi: "Wi-Fi",
};
const panelKeys = [
  "led.rows",
  "led.cols",
  "led.chain",
  "led.parallel",
  "led.gpio_mapping",
  "led.slowdown_gpio",
  "led.brightness",
];
const stationKeys = ["crs", "board", "colour", "platforms"];
function setupComplete() {
  return session.setupStep === "done";
}
// setupStep records progress through first-time setup, which only moves
// forward, so that a reload or a return after joining Wi-Fi carries on there.
async function advance(step) {
  const order = [...setupSteps, "done"];
  if (order.indexOf(step) <= order.indexOf(session.setupStep)) return;
  await api("setup", "PUT", { step });
  session.setupStep = step;
}
async function nextStep(step) {
  const next = setupSteps[setupSteps.indexOf(step) + 1] || "done";
  await advance(next);
  if (next !== "done") return navigate("/setup/" + next);
  await navigate("/board");
  notice("Setup is complete.", "success");
}
// Requests go one at a time, so that clearing the last step's pattern can't
// overtake the next step's.
let patternQueue = Promise.resolve();
function showPattern(pattern) {
  patternShown = Boolean(pattern);
  patternQueue = patternQueue
    .then(() => api("test-pattern", "POST", { pattern }))
    .catch((error) => notice(error.message, "error"));
  return patternQueue;
}
function leaveSetup() {
  if (patternShown) void showPattern("");
  if (currentStep === "wifi")
    $("network-page").insertBefore(
      $("wifi-forms"),
      $("hotspot").closest("section"),
    );
  currentStep = undefined;
  $("setup").hidden = true;
}
function setupFields(container, keys, prefix) {
  container.replaceChildren();
  for (const key of keys) {
    const f = snapshot.fields.find((f) => f.key === key);
    if (f) container.append(field(f, prefix));
  }
}
async function saveSetup(changes, testPattern = "") {
  const values = structuredClone(snapshot.values);
  for (const [key, value] of Object.entries(changes)) set(values, key, value);
  const result = await api("config", "PUT", {
    values,
    revision: snapshot.revision,
    testPattern,
  });
  patternShown = Boolean(testPattern);
  snapshot.values = values;
  snapshot.revision = result.revision;
  // Board settings shows what setup saved, and keeps any unsaved changes.
  for (const [key, value] of Object.entries(changes)) {
    const input = $("setting-" + key);
    if (input?.tagName === "FIELDSET")
      for (const option of input.querySelectorAll("input"))
        option.checked = option.value === String(value);
    else if (input?.type === "checkbox") input.checked = value;
    else if (input)
      input.value = Array.isArray(value) ? value.join(", ") : value;
  }
  showRelevantFields($("config-fields"), "setting-");
  schedulePreviews();
}
function readFields(keys, prefix) {
  const changes = {};
  for (const key of keys) {
    const f = snapshot.fields.find((f) => f.key === key);
    if (f) changes[key] = inputValue(f, prefix);
  }
  return changes;
}
function showSetup(step) {
  const steps = setupComplete()
    ? session.passwordChangeRequired
      ? ["password"]
      : setupSteps
    : ["password", ...setupSteps];
  if (step !== currentStep) {
    leaveSetup();
    currentStep = step;
    enterStep(step);
  }
  currentTab = undefined;
  $("login").hidden = true;
  $("app").hidden = true;
  $("setup").hidden = false;
  $("setup-title").textContent = stepTitles[step];
  $("setup-exit").hidden = !setupComplete() || session.passwordChangeRequired;
  const reached = setupComplete()
    ? steps.length
    : steps.indexOf(session.setupStep);
  const list = $("setup-steps");
  list.replaceChildren();
  steps.forEach((name, i) => {
    const item = document.createElement("li");
    const done =
      name === "password" ? !session.passwordChangeRequired : i < reached;
    item.className = name === step ? "current" : done ? "done" : "";
    if (name === step) item.setAttribute("aria-current", "step");
    if (
      name !== step &&
      name !== "password" &&
      !session.passwordChangeRequired &&
      i <= reached
    ) {
      const link = text("a", stepNames[name]);
      link.href = "/setup/" + name;
      item.append(link);
    } else item.append(text("span", stepNames[name]));
    list.append(item);
  });
  const index = setupSteps.indexOf(step);
  $("setup-back").hidden = index < 1;
  $("setup-back").onclick = () => navigate("/setup/" + setupSteps[index - 1]);
  for (const section of document.querySelectorAll("[data-step]"))
    section.hidden = section.dataset.step !== step;
}
function enterStep(step) {
  notice("");
  if (step === "password") {
    $("setup-password-form").reset();
    $("setup-new-password").focus();
  }
  if (step === "panels") {
    setupFields($("setup-panel-fields"), panelKeys, "setup-");
    $("panels-check").hidden = true;
    $("panels-help").hidden = true;
  }
  if (step === "colours") startColours();
  if (step === "station") {
    setupFields($("setup-station-fields"), stationKeys, "setup-");
    $("setup-crs").required = true;
    schedulePreviews();
  }
  if (step === "wifi") {
    $("setup-wifi-slot").append($("wifi-forms"));
    void status();
    scan();
  }
}
$("setup-exit").onclick = () => navigate("/board");
$("setup-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("setup-new-password").value !== $("setup-confirm-password").value) {
    notice("The passwords don't match.", "error");
    return;
  }
  const button = event.submitter;
  button.disabled = true;
  try {
    await api("password", "POST", {
      password: $("setup-new-password").value,
    });
    session.passwordChangeRequired = false;
    $("setup-password-form").reset();
    await navigate(setupComplete() ? "/board" : "/setup/" + session.setupStep);
    notice("Password changed.", "success");
  } catch (error) {
    notice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("setup-panels-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  notice("Restarting the display…");
  try {
    const changes = readFields(panelKeys, "setup-");
    await saveSetup(changes, "layout");
    const panels = changes["led.chain"] * changes["led.parallel"];
    $("panels-expected").textContent =
      panels === 1
        ? "The board outlines its panel in white and labels it Panel 1."
        : "The board outlines each of its " +
          panels +
          " panels in white and labels them Panel 1 to Panel " +
          panels +
          ", in the order that they're chained.";
    $("panels-check").hidden = false;
    $("panels-help").hidden = true;
    notice("");
    $("panels-check").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    notice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("panels-yes").onclick = () => nextStep("panels");
$("panels-no").onclick = () => ($("panels-help").hidden = false);
const colourPatterns = ["red", "green", "blue"];
const colourWords = { R: "red", G: "green", B: "blue" };
function startColours(message = "") {
  colourSeen = "";
  $("colour-check").hidden = true;
  $("colour-fault").hidden = true;
  $("colour-help").hidden = !message;
  $("colour-help").textContent = message;
  askColour();
}
function askColour() {
  $("colour-question").hidden = false;
  $("colour-count").textContent = "Colour " + (colourSeen.length + 1) + " of 3";
  for (const button of document.querySelectorAll(".colour-choice"))
    button.disabled = false;
  void showPattern(colourPatterns[colourSeen.length]);
}
for (const button of document.querySelectorAll(".colour-choice"))
  button.onclick = async () => {
    const colour = button.dataset.colour;
    if (!colour) {
      $("colour-question").hidden = true;
      $("colour-help").hidden = false;
      $("colour-help").textContent =
        "If the board shows white, a mix of colours, or nothing at all, the colour order can't fix it. Check that the ribbon cable is firmly in each panel's input connector and that the panels have power, and then start again.";
      $("colour-fault").hidden = false;
      return;
    }
    if (colourSeen.includes(colour)) {
      startColours(
        "You chose " +
          colourWords[colour] +
          " for two different colours, but each one lights differently. Look closely at the board, and answer again from the first colour.",
      );
      return;
    }
    colourSeen += colour;
    $("colour-help").hidden = true;
    if (colourSeen.length < 3) return askColour();
    for (const choice of document.querySelectorAll(".colour-choice"))
      choice.disabled = true;
    await applyColours();
  };
async function applyColours() {
  try {
    const key = "led.rgb_sequence";
    const current =
      get(snapshot.values, key) ??
      snapshot.fields.find((f) => f.key === key).default;
    const { sequence } = await api("colour-order", "POST", {
      current,
      seen: colourSeen,
    });
    if (sequence === current) await showPattern("colours");
    else {
      notice("Restarting the display…");
      await saveSetup({ [key]: sequence }, "colours");
      notice("");
    }
    $("colour-question").hidden = true;
    $("colour-check").hidden = false;
  } catch (error) {
    notice(error.message, "error");
    startColours();
  }
}
$("colours-yes").onclick = () => nextStep("colours");
$("colours-no").onclick = () =>
  startColours(
    "Look at the board again, and choose the colour that it shows each time.",
  );
$("colours-restart").onclick = () => startColours();
$("colours-skip").onclick = () => nextStep("colours");
$("setup-station-form").addEventListener("input", () => {
  showRelevantFields($("setup-station-fields"), "setup-");
  schedulePreviews();
});
$("setup-station-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await saveSetup(readFields(stationKeys, "setup-"));
    await nextStep("station");
  } catch (error) {
    notice(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("setup-finish").onclick = () => nextStep("wifi");
$("ssh-reload").onclick = () => {
  if (sshDirty && !confirm("Discard your unsaved SSH key changes and reload?"))
    return;
  loadSSHKeys();
};
$("ssh-keys").addEventListener("input", () => {
  sshDirty = $("ssh-keys").value !== sshSnapshot?.keys;
  $("ssh-save-status").textContent = sshDirty
    ? "Unsaved SSH key changes"
    : "No unsaved changes.";
  sshControls(false);
});
$("ssh-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sshBusy || !sshSnapshot || !sshDirty) return;
  sshControls(true);
  try {
    const result = await api("ssh-keys", "PUT", {
      keys: $("ssh-keys").value,
      revision: sshSnapshot.revision,
    });
    sshSnapshot = result;
    $("ssh-keys").value = result.keys;
    sshDirty = false;
    $("ssh-save-status").textContent = "Saved.";
    notice(result.message, "success");
  } catch (error) {
    notice(error.message, "error");
  } finally {
    sshControls(false);
  }
});
// A background settings tab needs no service-status subprocesses. Slow requests
// also must not accumulate while a network change is in progress. Explicit
// refreshes after user actions still request fresh status independently.
function pollStatus() {
  if (
    !document.hidden &&
    loaded &&
    (!$("app").hidden || !$("setup").hidden) &&
    statusRequests === 0
  ) {
    void status();
  }
}
document.addEventListener("visibilitychange", pollStatus);
window.addEventListener("pageshow", pollStatus);

async function status() {
  statusRequests++;
  try {
    const data = await api("status"),
      n = data.network;
    if (!countryLoaded && n.country) {
      $("country").value = n.country;
      countryLoaded = true;
    }
    const state =
      {
        hotspot: "Setup hotspot",
        connected: "Connected to Wi-Fi",
        connecting: "Connecting to Wi-Fi…",
        starting: "Starting Wi-Fi…",
        unavailable: "Wi-Fi unavailable",
      }[n.mode] || n.mode;
    $("network-state").textContent = state;
    $("network-detail").textContent =
      n.mode === "hotspot"
        ? "DepartureBoard · " +
          n.clients +
          " device" +
          (n.clients === 1 ? "" : "s") +
          " connected"
        : n.ssid || n.message || "";
    $("header-status").textContent =
      n.mode === "connected"
        ? "Wi-Fi connected"
        : n.mode === "hotspot"
          ? "Setup hotspot"
          : "Connecting";
    $("board-state").textContent =
      data.board === "active"
        ? "Running"
        : data.board === "demo"
          ? "Preview mode"
          : data.board;
    $("setup-board-state").hidden =
      data.board === "active" || data.board === "demo";
    $("setup-board-state").textContent =
      "The display isn't running (" +
      data.board +
      "), so the board can't show test patterns. If it doesn't start within a minute, check the panel settings.";
    $("setup-wifi-state").textContent =
      n.mode === "connected"
        ? "The board is connected" +
          (n.ssid ? " to " + n.ssid : "") +
          ". To use a different Wi-Fi network, choose it here. Otherwise, finish setup."
        : "To show live departures, the board needs the internet. Choose your Wi-Fi network. When the board joins it, the setup hotspot turns off, so join the same network on this device.";
    $("demo-label").textContent = data.demo
      ? "Local demo · no hardware changes"
      : "";
    $("addresses").replaceChildren();
    for (const ip of n.ips || []) {
      const link = document.createElement("a");
      link.textContent = "http://" + ip;
      link.href = "http://" + ip;
      $("addresses").append(link);
    }
    if (switching && n.mode !== "connecting") {
      switching = false;
      notice(
        n.message ||
          (n.mode === "connected"
            ? "Connected. Open http://departureboard.local on your network."
            : "Setup hotspot. Open http://192.168.4.1."),
        n.mode === "connected" ? "success" : "",
      );
    } else if (n.message && !dirty) notice(n.message);
  } catch (error) {
    if (!$("app").hidden) {
      $("header-status").textContent = "Reconnecting";
      if (switching)
        notice(
          "The board is changing networks. Join your chosen Wi-Fi, then open http://departureboard.local. If connection fails, reconnect to DepartureBoard and open http://192.168.4.1.",
        );
    }
  } finally {
    statusRequests--;
  }
}
async function scan() {
  const button = $("scan");
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "Scanning…";
  try {
    const networks = await api("networks");
    $("network-list").replaceChildren();
    if (!networks.length)
      $("network-list").textContent =
        "No networks found. Enter your network name manually.";
    for (const network of networks) {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "network-choice";
      const name = document.createElement("span");
      name.textContent = network.ssid;
      const signal = document.createElement("small");
      signal.textContent =
        network.signal + "% · " + (network.security || "Open");
      choice.append(name, signal);
      choice.onclick = () => {
        $("ssid").value = network.ssid;
        $("open-network").checked =
          !network.security || network.security === "--";
        updateOpen();
        $("wifi-password").focus();
      };
      $("network-list").append(choice);
    }
  } catch (error) {
    $("network-list").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Scan again";
  }
}
$("scan").onclick = scan;
function updateOpen() {
  const open = $("open-network").checked;
  $("wifi-password").disabled = open;
  $("wifi-password").required = !open;
  if (open) $("wifi-password").value = "";
}
$("open-network").onchange = updateOpen;
updateOpen();
$("show-wifi-password").onclick = () => {
  const shown = $("wifi-password").type === "password";
  $("wifi-password").type = shown ? "text" : "password";
  $("show-wifi-password").textContent = shown ? "Hide" : "Show";
};
$("wifi-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("connect").disabled = true;
  try {
    // Joining the network takes the board off the setup hotspot, and this page
    // with it, so setup has to be recorded as finished first.
    if (!$("setup").hidden) await advance("done");
    const result = await api("network", "POST", {
      ssid: $("ssid").value,
      password: $("wifi-password").value,
      country: $("country").value.toUpperCase(),
      open: $("open-network").checked,
      hidden: $("hidden-network").checked,
    });
    $("wifi-password").value = "";
    switching = true;
    notice(result.message);
    await status();
  } catch (error) {
    notice(error.message, "error");
  } finally {
    $("connect").disabled = false;
  }
});
$("hotspot").onclick = async () => {
  if (
    !confirm(
      "Forget the saved Wi-Fi network and switch to the DepartureBoard hotspot?",
    )
  )
    return;
  try {
    const result = await api("hotspot", "POST", {});
    switching = true;
    notice(result.message);
  } catch (error) {
    notice(error.message, "error");
  }
};
$("restart").onclick = async () => {
  try {
    const result = await api("restart", "POST", {});
    notice(result.message, "success");
  } catch (error) {
    notice(error.message, "error");
  }
};
$("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("new-password").value !== $("confirm-password").value) {
    notice("The passwords do not match.", "error");
    return;
  }
  try {
    const result = await api("password", "POST", {
      password: $("new-password").value,
    });
    $("password-form").reset();
    notice(result.message, "success");
  } catch (error) {
    notice(error.message, "error");
  }
});
const channelHelp = {
  stable: "Tested releases. Recommended for most boards.",
  prerelease:
    "The newest release, including test releases before they become stable.",
  development: "Every change to the code, as soon as it passes the tests.",
};
const busyText = {
  checking: "Checking for updates…",
  downloading: "Downloading the update…",
  installing:
    "Installing the update. The display and this page restart, which takes about a minute.",
};
function when(time) {
  return !time || time.startsWith("0001-")
    ? ""
    : new Date(time).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}
function describe(build) {
  return build
    ? build.version + " (build " + build.build + ")"
    : "Unknown — this board doesn't record its version.";
}
function megabytes(bytes) {
  return (bytes / 1e6).toFixed(1) + " MB";
}
function text(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}
function externalLink(href, content) {
  const link = text("a", content);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  return link;
}
const inlineMarkdown =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|(?<!\w)([*_])(?!\s)(.+?)(?<!\s)\5(?!\w)|(https?:\/\/[^\s<]*[^\s<.,:;"')\]])/g;
function inline(parent, source) {
  let end = 0;
  for (const match of source.matchAll(inlineMarkdown)) {
    const [whole, code, label, href, strong, , emphasis, url] = match;
    parent.append(source.slice(end, match.index));
    end = match.index + whole.length;
    if (code) parent.append(text("code", code));
    // A javascript: link would run with the signed-in management session.
    else if (label && /^https?:\/\//i.test(href))
      parent.append(inline(externalLink(href, ""), label));
    else if (label) inline(parent, label);
    else if (strong)
      parent.append(inline(document.createElement("strong"), strong));
    else if (emphasis)
      parent.append(inline(document.createElement("em"), emphasis));
    else parent.append(externalLink(url, url));
  }
  parent.append(source.slice(end));
  return parent;
}
// GitHub keeps single line breaks in release notes, so this does too.
function markdown(source) {
  const box = document.createElement("div");
  box.className = "release-notes";
  let paragraph = null,
    list = null,
    fence = null;
  for (const line of source.split(/\r?\n/)) {
    if (fence) {
      if (/^\s*```/.test(line)) fence = null;
      else fence.textContent += line + "\n";
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*?)(\s+#+)?\s*$/),
      item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
    if (!line.trim()) paragraph = null;
    else if (/^\s*```/.test(line)) {
      const pre = box.appendChild(document.createElement("pre"));
      fence = pre.appendChild(document.createElement("code"));
      paragraph = list = null;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      box.append(document.createElement("hr"));
      paragraph = list = null;
    } else if (heading) {
      box.append(inline(document.createElement("h4"), heading[1]));
      paragraph = list = null;
    } else if (item) {
      const tag = item[1] ? "OL" : "UL";
      if (list?.tagName !== tag) {
        list = box.appendChild(document.createElement(tag));
        if (item[1]) list.start = Number(item[1]);
      }
      paragraph = list.appendChild(
        inline(document.createElement("li"), item[2]),
      );
    } else if (paragraph) {
      paragraph.append(document.createElement("br"));
      inline(paragraph, line.trim());
    } else {
      paragraph = box.appendChild(
        inline(document.createElement("p"), line.trim()),
      );
      list = null;
    }
  }
  return box;
}
function showUpdateSettings(settings) {
  $("update-channel").value = settings.channel;
  $("update-schedule").value = settings.schedule;
  $("update-weekday").value = String(settings.weekday);
  $("update-time").value = settings.time;
  $("update-auto").checked = settings.autoInstall;
  updateDirty = false;
  $("update-save-status").textContent = "No unsaved changes.";
  updateSettingsForm();
}
function updateSettingsForm() {
  const channel = $("update-channel").value,
    schedule = $("update-schedule").value;
  $("update-channel-help").textContent = channelHelp[channel];
  $("update-dev-warning").hidden = channel !== "development";
  $("update-weekday").hidden = $("update-weekday-label").hidden =
    schedule !== "weekly";
  $("update-time").hidden = $("update-time-label").hidden = schedule === "off";
  $("update-time").required = schedule !== "off";
  $("update-auto").disabled = schedule === "off";
}
async function loadUpdates() {
  clearTimeout(updateTimer);
  let data;
  try {
    data = await api("update/status");
  } catch (error) {
    // The manager restarts while an update installs, so keep waiting for it.
    if (!$("updates-page").hidden) updateTimer = setTimeout(loadUpdates, 3000);
    return;
  }
  $("device-version").textContent = data.running;
  $("update-installed").textContent = describe(data.installed);
  $("update-last-check").textContent = when(data.lastCheck) || "Never";
  $("update-next-check").textContent =
    when(data.nextCheck) ||
    (data.settings.schedule === "off" ? "Not scheduled" : "Soon");
  if (!updateDirty) showUpdateSettings(data.settings);
  const result = data.lastResult;
  $("update-result").textContent = result
    ? when(result.time) + ": " + result.message
    : "";
  $("update-result").className =
    "small " + (result && !result.ok ? "error-text" : "");
  showAvailable(data);
  $("update-check").disabled = Boolean(data.busy);
  if (data.busy) updateTimer = setTimeout(loadUpdates, 2000);
}
function showAvailable(data) {
  const box = $("update-available"),
    install = $("update-install"),
    a = data.available;
  box.replaceChildren();
  install.hidden = true;
  $("update-heading").textContent = "Available update";
  if (data.busy) {
    box.append(text("p", busyText[data.busy] || data.busy));
    return;
  }
  if (!data.canVerify)
    box.append(
      text(
        "p",
        "This version of the board can't check for updates. Reflash it with a newer image.",
        "error-text",
      ),
    );
  if (data.error) box.append(text("p", data.error, "error-text"));
  if (!a) {
    if (!data.error)
      box.append(
        text("p", "Check for updates to see what's available.", "muted"),
      );
    return;
  }
  if (a.upToDate) {
    box.append(text("p", "This board is up to date."));
    return;
  }
  $("update-heading").textContent = a.name || a.version;
  const facts = document.createElement("dl");
  facts.className = "facts";
  for (const [term, value] of [
    ["Version", a.version + " (build " + a.build + ")"],
    ["Published", when(a.publishedAt)],
    ["Download", a.download ? megabytes(a.download) : "Nothing to download"],
    ["Files changed", String(a.changes?.length || 0)],
  ]) {
    if (value) facts.append(text("dt", term), text("dd", value));
  }
  box.append(facts);
  if (a.notes) box.append(markdown(a.notes));
  if (a.url) {
    const paragraph = text("p", "");
    paragraph.append(externalLink(a.url, "View on GitHub"));
    box.append(paragraph);
  }
  if (a.channel === "development" && a.newer) showCommits(box, a.commit);
  if (a.conflicts?.length) {
    box.append(
      text(
        "p",
        "This update can't be installed, because it would replace files that were changed on this board. Undo the changes, or reflash the board, to update.",
        "error-text",
      ),
    );
    const list = document.createElement("ul");
    list.className = "conflicts";
    for (const conflict of a.conflicts) {
      const item = document.createElement("li");
      item.append(
        text("code", conflict.path),
        text("span", " — " + conflict.reason),
      );
      if (conflict.diff) {
        const details = document.createElement("details");
        details.append(
          text("summary", "Compare with the update"),
          text("pre", conflict.diff, "diff"),
        );
        item.append(details);
      }
      list.append(item);
    }
    box.append(list);
    return;
  }
  if (a.missingPackages?.length) {
    box.append(
      text(
        "p",
        "This update needs software that isn't installed on this board: " +
          a.missingPackages.join(", ") +
          ". Reflash the board to update.",
        "error-text",
      ),
    );
    return;
  }
  install.hidden = false;
  install.dataset.older = String(!a.newer);
  if (a.newer) install.textContent = "Install update";
  else {
    box.append(
      text(
        "p",
        "This channel is behind the version installed on this board. The board stays on its version until the channel catches up, or you can install this older version now.",
      ),
    );
    install.textContent = "Install older version";
  }
}
async function showCommits(box, commit) {
  const list = document.createElement("ul");
  list.className = "commits";
  box.append(text("h4", "Changes"), list);
  if (commitsFor?.commit !== commit) {
    try {
      commitsFor = { commit, commits: await api("update/commits") };
    } catch (error) {
      list.replaceWith(text("p", "Couldn't list the changes.", "muted"));
      return;
    }
  }
  for (const c of commitsFor.commits.slice(0, 30)) {
    const item = document.createElement("li"),
      link = text("a", c.sha.slice(0, 7));
    link.href = c.url;
    link.target = "_blank";
    link.rel = "noopener";
    item.append(link, text("span", " " + c.message));
    list.append(item);
  }
  if (!commitsFor.commits.length)
    list.replaceWith(text("p", "No changes listed.", "muted"));
}
$("update-check").onclick = async () => {
  try {
    await api("update/check", "POST", {});
    await loadUpdates();
  } catch (error) {
    notice(error.message, "error");
  }
};
$("update-install").onclick = async () => {
  const older = $("update-install").dataset.older === "true";
  if (
    older &&
    !confirm(
      "Install an older version? If it can't use the board's settings, the update stops and nothing changes.",
    )
  )
    return;
  try {
    const result = await api("update/install", "POST", { allowOlder: older });
    notice(result.message);
    await loadUpdates();
  } catch (error) {
    notice(error.message, "error");
  }
};
$("update-settings").addEventListener("input", () => {
  updateDirty = true;
  $("update-save-status").textContent = "Unsaved changes";
  updateSettingsForm();
});
$("update-settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("update-save").disabled = true;
  try {
    const channelChanged =
      $("update-channel").value !== (await api("update/settings")).channel;
    const result = await api("update/settings", "PUT", {
      channel: $("update-channel").value,
      schedule: $("update-schedule").value,
      time: $("update-time").value || "03:00",
      weekday: Number($("update-weekday").value),
      autoInstall: $("update-auto").checked,
    });
    updateDirty = false;
    notice(result.message, "success");
    if (channelChanged) await api("update/check", "POST", {});
    await loadUpdates();
  } catch (error) {
    notice(error.message, "error");
  } finally {
    $("update-save").disabled = false;
  }
});
api("session")
  .then((data) => {
    session = data;
    return render();
  })
  .catch((error) => ($("login-error").textContent = error.message));
