#!/usr/bin/env python3
"""Stage board and manager payloads in a copy of a DietPi ARM64 image.

Requires Python 3 and mtools. Edits a copy through mtools, without mounting
partitions, root privileges, or executing anything from the ARM image.
Then run prepare-image.sh on Linux to install the offline runtime.
"""

import argparse
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile


DEPLOY = Path(__file__).resolve().parent.parent


def boot_offset(image):
    """Find the FAT boot partition in DietPi's DOS partition table."""
    with image.open("rb") as source:
        mbr = source.read(512)
    if len(mbr) != 512 or mbr[510:] != b"\x55\xaa":
        raise ValueError("Expected a DietPi image with an MBR partition table")
    partitions = []
    for index in range(4):
        entry = mbr[446 + index * 16 : 462 + index * 16]
        if entry[4] in (0x06, 0x0B, 0x0C, 0x0E):
            start, size = struct.unpack_from("<II", entry, 8)
            if not start or not size or (start + size) * 512 > image.stat().st_size:
                raise ValueError("FAT boot partition is outside the image")
            partitions.append(start * 512)
    if len(partitions) != 1:
        raise ValueError("Expected exactly one FAT boot partition")
    return partitions[0]


def set_settings(text, settings):
    """Replace active settings, preserving upstream comments and other keys."""
    remaining = dict(settings)
    lines = []
    for line in text.splitlines():
        match = re.match(r"^\s*([A-Z][A-Z0-9_]*)=", line)
        if match and match[1] in settings:
            key = match[1]
            if key in remaining:
                lines.append(f"{key}={remaining.pop(key)}")
        else:
            lines.append(line)
    lines.extend(f"{key}={value}" for key, value in remaining.items())
    return "\n".join(lines) + "\n"


def build_image(base, board, output, manager):
    for binary in (board, manager):
        with binary.open("rb") as source:
            header = source.read(20)
        if header[:6] != b"\x7fELF\x02\x01" or header[18:20] != b"\xb7\x00":
            raise ValueError("board and manager must be 64-bit little-endian ARM ELF binaries")
    offset = boot_offset(base)
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation also prevents accidentally overwriting the base image.
    with base.open("rb") as source, output.open("xb") as target:
        shutil.copyfileobj(source, target, 1024 * 1024)
    device = f"{output.resolve()}@@{offset}"

    def copy_in(source, destination):
        subprocess.run(["mcopy", "-o", "-i", device, str(source), f"::{destination}"], check=True)

    with tempfile.TemporaryDirectory(prefix="raildotmatrix-") as directory:
        stage = Path(directory)
        for name in ("dietpi.txt", "config.txt"):
            subprocess.run(["mcopy", "-i", device, f"::{name}", str(stage / name)], check=True)

        dietpi = stage / "dietpi.txt"
        dietpi.write_text(set_settings(dietpi.read_text(), {
            "AUTO_SETUP_AUTOMATED": "0",
            "AUTO_SETUP_CUSTOM_SCRIPT_EXEC": "0",
            "AUTO_SETUP_NET_HOSTNAME": "departureboard",
            "AUTO_SETUP_TIMEZONE": "Europe/London",
            "AUTO_SETUP_AUTOSTART_TARGET_INDEX": "0",
            "AUTO_SETUP_BOOT_WAIT_FOR_NETWORK": "0",
            "AUTO_SETUP_NET_WIFI_ENABLED": "1",
            "CONFIG_SOUNDCARD": "none",
            "SURVEY_OPTED_IN": "0",
        }))
        firmware = stage / "config.txt"
        # Apply to every Pi model, even if upstream ends in a model-specific section.
        firmware.write_text(firmware.read_text().rstrip() + "\n\n# LED matrix PWM conflicts with onboard audio.\n[all]\ndtparam=audio=off\n")

        config = stage / "departure-board.toml"
        config.write_text(
            "# Edit this file at the root of the SD card's boot partition.\n"
            "# The service reads /boot/firmware/departure-board.toml directly; reboot after\n"
            "# changing settings other than brightness.\n\n"
            + (DEPLOY / "departure-board.toml").read_text().replace('crs = "BTN"', 'crs = ""')
        )
        for name in ("dietpi.txt", "config.txt", "departure-board.toml"):
            copy_in(stage / name, name)
        copy_in(DEPLOY / "dietpi/README.txt", "RAILDOTMATRIX-README.txt")
        subprocess.run(["mmd", "-i", device, "::raildotmatrix"], check=True)
        copy_in(board, "raildotmatrix/board")
        copy_in(manager, "raildotmatrix/manage")
        for name in ("install-image.sh", "verify-image.sh", "firstboot.sh", "hotspot.nmconnection", "departure-board-manager.service", "departure-board-init.service", "avahi.service"):
            copy_in(DEPLOY / "dietpi" / name, "raildotmatrix/" + name)
        copy_in(DEPLOY / "departure-board.service", "raildotmatrix/departure-board.service")
        copy_in(DEPLOY / "dietpi/boot-config.conf", "raildotmatrix/boot-config.conf")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-image", type=Path, required=True, help="uncompressed official DietPi RPi234 ARMv8 Trixie .img")
    parser.add_argument("--board", type=Path, required=True, help="binary from just board")
    parser.add_argument("--output", type=Path, required=True, help="new uncompressed .img to create")
    parser.add_argument("--manager", type=Path, required=True, help="binary from just manager")
    args = parser.parse_args()
    build_image(args.base_image, args.board, args.output, args.manager)
    print(f"Staged {args.output}; run prepare-image.sh before flashing")


if __name__ == "__main__":
    main()
