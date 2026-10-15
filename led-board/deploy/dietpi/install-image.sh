#!/bin/bash
# Runs inside the target rootfs during image construction, never on the builder host.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
payload=/boot/firmware/raildotmatrix
chmod 755 /
chmod 1777 /tmp /var/tmp
apt-get update
mapfile -t packages < <(grep -Ev '^(#|$)' "$payload/packages.txt")
apt-get install -y --no-install-recommends "${packages[@]}"

# The manager binds this directory into its sandbox to manage root public keys.
install -d -m 700 /root/.ssh

# Updates replace exactly these files, and the installed manifest records them as shipped.
while read -r mode source path; do
    [[ $mode && $mode != \#* ]] || continue
    install -D -m "$mode" "$payload/${source##*/}" "$path"
done < "$payload/managed-files.txt"
install -d -m 700 /var/lib/departure-board
install -m 600 "$payload/installed-manifest.json" /var/lib/departure-board/installed-manifest.json

# NetworkManager owns both wired and wireless adapters in the appliance image.
# DietPi's interactive networking setup must not race with hotspot provisioning.
printf 'auto lo\niface lo inet loopback\n' > /etc/network/interfaces
systemctl disable networking.service dietpi-firstboot.service dietpi-postboot.service
systemctl mask networking.service
systemctl unmask dbus.service
systemctl enable NetworkManager.service avahi-daemon.service departure-board-init.service departure-board-manager.service departure-board.service dropbear.service
systemctl disable NetworkManager-wait-online.service
printf '2\n' > /boot/dietpi/.install_stage
printf 'departureboard\n' > /etc/hostname
sed -i '/^127\.0\.1\.1[[:space:]]/d' /etc/hosts
printf '127.0.1.1 departureboard\n' >> /etc/hosts
ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime
rm -f /etc/modprobe.d/dietpi-disable_wifi.conf
# Each flashed board gets its own machine identity and SSH host keys.
rm -f /etc/machine-id /var/lib/dbus/machine-id /etc/ssh/ssh_host_* /etc/dropbear/dropbear_*_host_key*
# firstboot.sh creates only an Ed25519 key. Without -r, Dropbear also tries the
# default RSA and ECDSA paths and logs a failure for each on every start.
printf '%s\n' 'DROPBEAR_EXTRA_ARGS="-r /etc/dropbear/dropbear_ed25519_host_key"' >> /etc/default/dropbear
: > /etc/machine-id
rm -f /var/lib/systemd/random-seed
apt-get clean
rm -rf /var/lib/apt/lists/*
