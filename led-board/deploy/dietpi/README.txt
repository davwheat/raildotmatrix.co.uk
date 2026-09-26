Raildotmatrix departure board
============================

Supports Raspberry Pi Zero 2 W, Pi 2 v1.2, Pi 3, Pi 4 and Pi 400 with a
HUB75 LED matrix. Original Pi Zero/Zero W and Pi 5 are not supported.

Flash the .img.xz using Raspberry Pi Imager (Use custom) or balenaEtcher.
Skip Imager's OS customisation. Before first boot, set your console/SSH
password in dietpi.txt: AUTO_SETUP_GLOBAL_PASSWORD. Set the Wi-Fi country
with AUTO_SETUP_NET_WIFI_COUNTRY_CODE (default GB).

1. Connect the panels and power on. Setup works without internet access.
2. Join Wi-Fi network DepartureBoard. Password: DotMatrix
3. Open http://192.168.4.1 and sign in. Board password: DotMatrix
4. Select Wi-Fi & connection and connect the Pi to your network.
5. Join that network on your device and open http://departureboard.local.
6. Enter your station's three-letter code in Board settings and save.

The hotspot returns if the Wi-Fi connection fails. Ethernet uses DHCP.
If mDNS is unavailable, use the Pi's IP address shown on the LED display
or in your router's connected devices.

Until you choose a station, the LED matrix shows the hotspot name and
password. When a device joins the hotspot, it changes to setup URLs.
When the last device leaves, it returns to the name/password prompt.
On your home network, it shows departureboard.local and the assigned IP.

The GUI edits all board and panel settings, validates them and restarts
the display. Device settings let you change the web password and restart
the display. The hotspot password remains DotMatrix.

Manual configuration is also supported: departure-board.toml is at the
root of this partition (/boot/firmware/departure-board.toml on the Pi).
The default is two chained 128x64 panels, with no station set. Edit the
panel settings before boot if needed. Brightness changes apply live;
restart the service or reboot for other manual changes. Shut down before
removing the card to edit it on another computer.

Logs: journalctl -u departure-board -u departure-board-manager -f
Restart display: systemctl restart departure-board
Reset web password: remove /var/lib/departure-board/password.json and
restart departure-board-manager. The default becomes DotMatrix again.

Source and documentation: https://github.com/davwheat/raildotmatrix.co.uk
