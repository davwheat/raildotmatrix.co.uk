#!/bin/bash
# Install the management runtime into the image in CI, so setup works offline.
set -euo pipefail
[[ $(uname -s) == Linux && $EUID == 0 && $# == 1 && -f $1 ]] || { echo 'Usage: sudo prepare-image.sh IMAGE.img (Linux)' >&2; exit 1; }
image=$(realpath "$1")
# The supported DietPi image has FAT p1 followed by ext4 p2. Add space for the
# preinstalled packages; DietPi still expands p2 to the card size on first boot.
layout=$(python3 - "$image" <<'PY'
import struct, sys
with open(sys.argv[1], 'r+b') as f:
    mbr = bytearray(f.read(512))
    if mbr[510:] != b'\x55\xaa' or mbr[466] != 0x83 or any(mbr[478:510]):
        raise SystemExit('Expected the DietPi FAT + ext4 MBR layout')
    start, count = struct.unpack_from('<II', mbr, 470)
    f.seek(0, 2)
    size = f.tell()
    if (start + count) * 512 != size:
        raise SystemExit('Root partition must be last and end at the image boundary')
    f.truncate(size + 1024**3)
    struct.pack_into('<I', mbr, 474, count + 1024**3 // 512)
    f.seek(0)
    f.write(mbr)
    boot_start, boot_count = struct.unpack_from('<II', mbr, 454)
    print(boot_start * 512, boot_count * 512, start * 512, (count + 1024**3 // 512) * 512)
PY
)
read -r boot_offset boot_size root_offset root_size <<< "$layout"
root=$(mktemp -d)
boot_loop=
root_loop=
cleanup() {
    local result=$?
    trap - EXIT
    for path in sys proc dev boot/firmware ''; do
        if mountpoint -q "$root/${path}"; then umount "$root/${path}" || result=1; fi
    done
    [[ ! $boot_loop ]] || losetup --detach "$boot_loop" || result=1
    [[ ! $root_loop ]] || losetup --detach "$root_loop" || result=1
    rmdir "$root" || result=1
    exit "$result"
}
trap cleanup EXIT
root_loop=$(losetup --find --show --offset "$root_offset" --sizelimit "$root_size" "$image")
boot_loop=$(losetup --find --show --offset "$boot_offset" --sizelimit "$boot_size" "$image")
set +e
e2fsck -pf "$root_loop"
result=$?
set -e
(( result <= 1 ))
resize2fs "$root_loop"
mount "$root_loop" "$root"
mount "$boot_loop" "$root/boot/firmware"
for path in dev proc sys; do mount --bind "/$path" "$root/$path"; done
# policy-rc.d prevents package scripts from trying to start services in CI.
if [[ -e "$root/usr/sbin/policy-rc.d" ]]; then mv "$root/usr/sbin/policy-rc.d" "$root/usr/sbin/policy-rc.d.image-backup"; fi
printf '#!/bin/sh\nexit 101\n' > "$root/usr/sbin/policy-rc.d"
chmod 755 "$root/usr/sbin/policy-rc.d"
rm -f "$root/etc/resolv.conf"
cp -L /etc/resolv.conf "$root/etc/resolv.conf"
chroot "$root" /bin/bash /boot/firmware/raildotmatrix/install-image.sh
chroot "$root" /bin/bash /boot/firmware/raildotmatrix/verify-image.sh
rm "$root/usr/sbin/policy-rc.d"
if [[ -e "$root/usr/sbin/policy-rc.d.image-backup" ]]; then mv "$root/usr/sbin/policy-rc.d.image-backup" "$root/usr/sbin/policy-rc.d"; fi
ln -snf /run/NetworkManager/resolv.conf "$root/etc/resolv.conf"
sync
