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
  sshSnapshot = undefined;
  sshDirty = false;
  $("ssh-form").reset();
  $("ssh-keys").disabled = true;
  $("ssh-save").disabled = true;
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
    poll = setInterval(pollStatus, 5000);
    if (!$("developer-page").hidden) await loadSSHKeys();
    void loadUpdates();
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
  hide_terminating: "Hide terminating trains",
  warning_platform: "Name platforms in warnings",
  align_platform_rows: "Align lower service rows with platform box",
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
    "show_unconfirmed_platforms hide_terminating warning_platform platform_box compact_lower_row align_platform_rows small_scrolling_text ampersand_calling_points worldline page_destinations reserve_etd_column clear_down_warning_to_cis legacy_toc_names",
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
  if (dirty || sshDirty || updateDirty) {
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
    if (button.dataset.tab === "developer" && !sshSnapshot) loadSSHKeys();
    if (button.dataset.tab === "updates") loadUpdates();
  };
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
  if (!document.hidden && !$("app").hidden && statusRequests === 0) {
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
  if (a.notes) box.append(text("p", a.notes, "release-notes"));
  if (a.url) {
    const link = text("a", "View on GitHub");
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener";
    const paragraph = text("p", "");
    paragraph.append(link);
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
  .then((data) => (data.authenticated ? signedIn() : signedOut()))
  .catch((error) => ($("login-error").textContent = error.message));
