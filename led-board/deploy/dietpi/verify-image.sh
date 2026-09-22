#!/bin/bash
# Runs inside the prepared ARM image, without starting networking or using GPIO.
set -euo pipefail
/opt/departure-board/board -check-config -config /boot/firmware/departure-board.toml
/opt/departure-board/manage -help >/dev/null 2>&1
nmcli --offline connection modify connection.id departure-board-hotspot < /etc/NetworkManager/system-connections/departure-board-hotspot.nmconnection >/dev/null
systemd-analyze verify departure-board-init.service departure-board-manager.service departure-board.service
for service in NetworkManager avahi-daemon departure-board-init departure-board-manager departure-board; do
    systemctl is-enabled --quiet "$service.service"
done
for service in dietpi-firstboot dietpi-postboot NetworkManager-wait-online; do
    if systemctl is-enabled --quiet "$service.service"; then
        echo "Unexpected first-boot dependency: $service" >&2
        exit 1
    fi
done
test "$(cat /etc/hostname)" = departureboard
test "$(stat -c %a /etc/NetworkManager/system-connections/departure-board-hotspot.nmconnection)" = 600
# The GPIO renderer drops to daemon, which must be able to read the SD config.
setpriv --reuid=daemon --regid=daemon --clear-groups cat /boot/firmware/departure-board.toml >/dev/null
printf 'ARM executables, configuration, hotspot profile and systemd units verified.\n'
