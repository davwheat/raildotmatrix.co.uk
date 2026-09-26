"""Exercise image assembly on a real FAT filesystem without root or downloads."""

import hashlib
from pathlib import Path
import struct
import subprocess
import tempfile
import tomllib
import unittest

from build_image import DEPLOY, boot_offset, build_image, set_settings


class ImageTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.base = self.root / "base.img"
        self.output = self.root / "board.img"
        self.board = self.root / "board"
        self.board.write_bytes(b"\x7fELF\x02\x01" + bytes(12) + b"\xb7\x00" + b"test payload")

        # FAT16 boot partition followed by a stand-in root filesystem. The
        # builder must preserve the partition table and everything outside FAT.
        self.offset = 2048 * 512
        self.sectors = 65536
        self.root_offset = self.offset + self.sectors * 512
        mbr = bytearray(512)
        struct.pack_into("<B3sB3sII", mbr, 446, 0, bytes(3), 0x0E, bytes(3), 2048, self.sectors)
        struct.pack_into("<B3sB3sII", mbr, 462, 0, bytes(3), 0x83, bytes(3), 2048 + self.sectors, 2048)
        mbr[510:] = b"\x55\xaa"
        with self.base.open("wb") as target:
            target.write(mbr)
            target.truncate(self.root_offset + 2048 * 512)
            target.seek(self.root_offset)
            target.write(b"ROOT FILESYSTEM MUST NOT CHANGE")
        subprocess.run([
            "mformat", "-i", f"{self.base}@@{self.offset}",
            "-T", str(self.sectors), "-v", "DIETPI", "::",
        ], check=True)
        for name, contents in {
            "dietpi.txt": "# Upstream comment\nAUTO_SETUP_AUTOMATED=0\nAUTO_SETUP_NET_WIFI_ENABLED=0\nAUTO_SETUP_GLOBAL_PASSWORD=dietpi\n",
            "config.txt": "arm_64bit=1\ndtparam=audio=on\n[pi4]\nmax_framebuffers=2\n",
            "dietpi-wifi.txt": "aWIFI_SSID[0]=''\naWIFI_KEY[0]=''\n",
        }.items():
            source = self.root / name
            source.write_text(contents)
            subprocess.run(["mcopy", "-i", f"{self.base}@@{self.offset}", str(source), f"::{name}"], check=True)

    def read_boot(self, name):
        return subprocess.check_output(["mtype", "-i", f"{self.output}@@{self.offset}", f"::{name}"])

    def test_flashable_image_contains_board_and_editable_config(self):
        original = hashlib.sha256(self.base.read_bytes()).digest()
        build_image(self.base, self.board, self.output, self.board)
        self.assertEqual(hashlib.sha256(self.base.read_bytes()).digest(), original)
        self.assertEqual(self.output.stat().st_size, self.base.stat().st_size)
        self.assertEqual(boot_offset(self.output), self.offset)
        with self.base.open("rb") as base, self.output.open("rb") as output:
            self.assertEqual(base.read(self.offset), output.read(self.offset))
            base.seek(self.root_offset)
            output.seek(self.root_offset)
            self.assertEqual(base.read(), output.read())

        self.assertEqual(self.read_boot("raildotmatrix/board"), self.board.read_bytes())
        self.assertEqual(self.read_boot("raildotmatrix/departure-board.service"), (DEPLOY / "departure-board.service").read_bytes())
        self.assertEqual(self.read_boot("raildotmatrix/boot-config.conf"), (DEPLOY / "dietpi/boot-config.conf").read_bytes())
        self.assertEqual(self.read_boot("raildotmatrix/manage"), self.board.read_bytes())
        self.assertEqual(self.read_boot("raildotmatrix/install-image.sh"), (DEPLOY / "dietpi/install-image.sh").read_bytes())
        self.assertIn(b"ssid=DepartureBoard", self.read_boot("raildotmatrix/hotspot.nmconnection"))
        self.assertIn(b"psk=DotMatrix", self.read_boot("raildotmatrix/hotspot.nmconnection"))
        self.assertEqual(self.read_boot("dietpi-wifi.txt"), (self.root / "dietpi-wifi.txt").read_bytes())
        self.assertIn(b"departure-board.toml", self.read_boot("RAILDOTMATRIX-README.txt"))
        config = tomllib.loads(self.read_boot("departure-board.toml").decode())
        expected = tomllib.loads((DEPLOY / "departure-board.toml").read_text())
        expected["crs"] = ""
        self.assertEqual(config, expected)
        settings = self.read_boot("dietpi.txt").decode()
        self.assertIn("AUTO_SETUP_AUTOMATED=0\n", settings)
        self.assertIn("AUTO_SETUP_CUSTOM_SCRIPT_EXEC=0\n", settings)
        self.assertIn("AUTO_SETUP_NET_WIFI_ENABLED=1\n", settings)
        self.assertIn("AUTO_SETUP_GLOBAL_PASSWORD=dietpi\n", settings)
        self.assertIn("AUTO_SETUP_BOOT_WAIT_FOR_NETWORK=0\n", settings)
        self.assertTrue(self.read_boot("config.txt").endswith(b"[all]\ndtparam=audio=off\n"))

        # The file a user edits after flashing is the same one the service reads.
        edited = self.root / "edited.toml"
        edited.write_text('crs = "VIC"\n')
        subprocess.run(["mcopy", "-o", "-i", f"{self.output}@@{self.offset}", str(edited), "::departure-board.toml"], check=True)
        self.assertEqual(self.read_boot("departure-board.toml"), edited.read_bytes())
        self.assertIn(b"-config /boot/firmware/departure-board.toml", self.read_boot("raildotmatrix/boot-config.conf"))

    def test_refuses_to_overwrite_an_image(self):
        self.output.write_bytes(b"keep me")
        with self.assertRaises(FileExistsError):
            build_image(self.base, self.board, self.output, self.board)
        self.assertEqual(self.output.read_bytes(), b"keep me")

    def test_rejects_wrong_architecture_before_creating_output(self):
        self.board.write_bytes(b"\x7fELF\x02\x01" + bytes(12) + b"\x3e\x00")
        with self.assertRaisesRegex(ValueError, "ARM ELF"):
            build_image(self.base, self.board, self.output, self.board)
        self.assertFalse(self.output.exists())

    def test_rejects_truncated_partition(self):
        with self.base.open("r+b") as target:
            target.truncate(self.offset + 512)
        with self.assertRaisesRegex(ValueError, "outside the image"):
            build_image(self.base, self.board, self.output, self.board)
        self.assertFalse(self.output.exists())


class SettingsTest(unittest.TestCase):
    def test_preserves_comments_and_network_settings_without_duplicate_overrides(self):
        text = "#AUTO_SETUP_AUTOMATED=0\r\nAUTO_SETUP_AUTOMATED=0\r\nAUTO_SETUP_NET_WIFI_ENABLED=1\r\nAUTO_SETUP_AUTOMATED=0\r\n"
        settings = {"AUTO_SETUP_AUTOMATED": "1", "AUTO_SETUP_TIMEZONE": "Europe/London"}
        result = set_settings(text, settings)
        self.assertEqual(result, "#AUTO_SETUP_AUTOMATED=0\nAUTO_SETUP_AUTOMATED=1\nAUTO_SETUP_NET_WIFI_ENABLED=1\nAUTO_SETUP_TIMEZONE=Europe/London\n")
        self.assertEqual(set_settings(result, settings), result)


if __name__ == "__main__":
    unittest.main()
