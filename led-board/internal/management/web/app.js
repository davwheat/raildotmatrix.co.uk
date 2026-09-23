"use strict";
const $ = (id) => document.getElementById(id);
let snapshot,
  dirty = false,
  switching = false,
  countryLoaded = false,
  poll;
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
  $("login").hidden = false;
  $("app").hidden = true;
}
async function signedIn() {
  $("login").hidden = true;
  $("app").hidden = false;
  $("login-password").value = "";
  try {
    await loadConfig();
    await status();
    clearInterval(poll);
    poll = setInterval(status, 5000);
  } catch (error) {
    notice(error.message, "error");
  }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await api("login", "POST", { password: $("login-password").value });
    $("login-error").textContent = "";
    await signedIn();
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
  warning_platform: "Name platforms in warnings",
  align_platform_rows: "Align lower service rows with platform box",
  compact_lower_row: "Show lower service row beside clock",
  platform_box: "Infotec platform box",
  worldline: "Worldline display style",
  legacy_toc_names: "Use historic operator names",
  scroll_speed: "Scroll speed (dots / second)",
  small_scrolling_text: "Use smaller scrolling text",
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
  "led.no_drop_privs": "Keep root privileges",
  "led.show_refresh": "Log panel refresh rate",
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
const groups = [
  [
    "Station",
    "Leave the station empty to show setup instructions.",
    "crs board colour platforms row_prefix loading_brightness formation_count coach_letter_tocs formation_icons clock_style ordinal_format service_count scroll_speed",
  ],
  [
    "Display options",
    "",
    "show_unconfirmed_platforms warning_platform platform_box compact_lower_row align_platform_rows small_scrolling_text worldline legacy_toc_names",
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
function field(field) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = labels[field.key] || field.key.replaceAll("_", " ");
  label.htmlFor = "setting-" + field.key;
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
    auto.id = "auto-" + field.key;
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
  help.textContent =
    field.key === "crs"
      ? "Three-letter CRS code, e.g. BTN for Brighton."
      : field.key === "platforms"
        ? "Separate platform numbers with commas. Leave empty for all platforms."
        : field.help;
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
  dirty = false;
  $("save-status").textContent = get(snapshot.values, "crs")
    ? "No unsaved changes."
    : "Choose a station to start showing live departures.";
}
$("config-form").addEventListener("input", () => {
  dirty = true;
  $("save-status").textContent = "Unsaved changes";
});
$("config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("save");
  button.disabled = true;
  try {
    const values = structuredClone(snapshot.values);
    for (const f of snapshot.fields) {
      const input = $("setting-" + f.key);
      if (f.automatic && $("auto-" + f.key).checked) {
        unset(values, f.key);
        continue;
      }
      let value =
        f.type === "bool"
          ? input.checked
          : f.type === "int"
            ? Number(input.value)
            : f.type === "stringSlice"
              ? input.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
              : input.value;
      if (f.type === "int" && input.value === "")
        throw new Error("Enter a value for " + (labels[f.key] || f.key));
      set(values, f.key, value);
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
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
for (const button of document.querySelectorAll("[data-tab]"))
  button.onclick = () => {
    for (const item of document.querySelectorAll("[data-tab]")) {
      const active = item === button;
      item.classList.toggle("selected", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
      $(item.dataset.tab + "-page").hidden = !active;
    }
    if (button.dataset.tab === "network") scan();
  };
async function status() {
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
    await api("password", "POST", { password: $("new-password").value });
    $("password-form").reset();
    signedOut();
    $("login-error").textContent =
      "Password changed. Sign in with your new password.";
  } catch (error) {
    notice(error.message, "error");
  }
});
api("session")
  .then((data) => (data.authenticated ? signedIn() : signedOut()))
  .catch((error) => ($("login-error").textContent = error.message));
