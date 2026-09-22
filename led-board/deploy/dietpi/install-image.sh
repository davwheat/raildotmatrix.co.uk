#!/bin/bash
# Runs inside the target rootfs during image construction, never on the builder host.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
payload=/boot/firmware/raildotmatrix
chmod 755 /
chmod 1777 /tmp /var/tmp
apt-get update
apt-get install -y --no-install-recommends network-manager dnsmasq-base avahi-daemon iw rfkill ca-certificates tzdata

install -D -m 755 "$payload/board" /opt/departure-board/board
install -D -m 755 "$payload/manage" /opt/departure-board/manage
install -D -m 644 "$payload/departure-board.service" /etc/systemd/system/departure-board.service
install -D -m 644 "$payload/boot-config.conf" /etc/systemd/system/departure-board.service.d/boot-config.conf
install -D -m 644 "$payload/departure-board-manager.service" /etc/systemd/system/departure-board-manager.service
install -D -m 644 "$payload/departure-board-init.service" /etc/systemd/system/departure-board-init.service
install -D -m 755 "$payload/firstboot.sh" /opt/departure-board/firstboot.sh
install -D -m 600 "$payload/hotspot.nmconnection" /etc/NetworkManager/system-connections/departure-board-hotspot.nmconnection
install -D -m 644 "$payload/avahi.service" /etc/avahi/services/departure-board.service
mkdir -p /etc/NetworkManager/conf.d
cat > /etc/NetworkManager/conf.d/departure-board.conf <<'CONF'
[main]
plugins=keyfile
[device]
wifi.scan-rand-mac-address=no
CONF
# NetworkManager owns both wired and wireless adapters in the appliance image.
# DietPi's interactive networking setup must not race with hotspot provisioning.
printf 'auto lo\niface lo inet loopback\n' > /etc/network/interfaces
systemctl disable networking.service dietpi-firstboot.service dietpi-postboot.service
systemctl mask networking.service
systemctl unmask dbus.service
systemctl enable NetworkManager.service avahi-daemon.service departure-board-init.service departure-board-manager.service departure-board.service
systemctl disable NetworkManager-wait-online.service
printf '2\n' > /boot/dietpi/.install_stage
printf 'departureboard\n' > /etc/hostname
sed -i '/^127\.0\.1\.1[[:space:]]/d' /etc/hosts
printf '127.0.1.1 departureboard\n' >> /etc/hosts
ln -snf /usr/share/zoneinfo/Europe/London /etc/localtime
printf '%s\n' 'blacklist snd_bcm2835' > /etc/modprobe.d/raildotmatrix.conf
rm -f /etc/modprobe.d/dietpi-disable_wifi.conf
# Each flashed board gets its own machine identity and SSH host keys.
rm -f /etc/machine-id /var/lib/dbus/machine-id /etc/ssh/ssh_host_* /etc/dropbear/dropbear_*_host_key
: > /etc/machine-id
rm -f /var/lib/systemd/random-seed
apt-get clean
rm -rf /var/lib/apt/lists/*
