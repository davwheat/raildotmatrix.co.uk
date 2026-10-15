#!/bin/bash
# Per-device initialization; all required packages were already installed in CI.
set -euo pipefail
mkdir -p /var/lib/departure-board
chmod 700 /var/lib/departure-board
systemd-machine-id-setup
# Keep DietPi's SD-card password setting for SSH/console access. Do not log it.
password=$(sed -n '/^AUTO_SETUP_GLOBAL_PASSWORD=/{s/^[^=]*=//p;q}' /boot/dietpi.txt)
if [[ $password ]]; then
    printf 'root:%s\ndietpi:%s\n' "$password" "$password" | chpasswd
    sed -i 's/^AUTO_SETUP_GLOBAL_PASSWORD=.*/AUTO_SETUP_GLOBAL_PASSWORD=/' /boot/dietpi.txt
fi
unset password
# DietPi creates these in dietpi-firstboot, which the image disables, and Debian's
# Dropbear unit doesn't pass -R, so Dropbear can't start without them.
key=/etc/dropbear/dropbear_ed25519_host_key
rm -f "$key" "$key.pub"
dropbearkey -t ed25519 -f "$key"
# The manager applies this before activating Wi-Fi. It can later be changed in the GUI.
country=$(sed -n '/^AUTO_SETUP_NET_WIFI_COUNTRY_CODE=/{s/^[^=]*=//p;q}' /boot/dietpi.txt)
[[ $country =~ ^[A-Z]{2}$ ]] || country=GB
printf '%s' "$country" > /var/lib/departure-board/country
rfkill unblock wifi || true # Ethernet-only boards may have no radio.
touch /var/lib/departure-board/initialised
