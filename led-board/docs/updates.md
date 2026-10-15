# Over-the-air updates

Boards flashed with the DietPi image update themselves from GitHub releases. The web GUI's **Updates**
tab checks for updates on demand or on a schedule, and can install them automatically.

## Channels

Each board follows one channel:

| Channel | Source |
| --- | --- |
| Stable | The latest GitHub release that isn't a prerelease. |
| Prerelease | The newest published release, including prereleases. |
| Development | The `dev` prerelease, which CI replaces with every successful build of `main`. |

A board starts on the channel of the image it was flashed with. Builds are numbered by the commits that
lead to them (`git rev-list --count`), so one number orders builds from every channel. This relies on
release tags being cut from commits on `main`.

A board offers an update only when the channel's build number is higher than the installed one. After a
board moves to a channel that's behind it, such as from development back to stable, it stays on its
build until the channel catches up. The GUI offers **Install older version** for anyone who wants to go
back sooner.

## What a release contains

`cmd/release` packs each build into these assets:

- `board.xz` and `manage.xz`: the two binaries, shared by every image variant.
- `system-files.tar.xz`: every other managed file.
- `manifest-VARIANT.json`: the version, commit, build number and channel, the Debian packages the build
  needs, and each managed file's path, mode, SHA-256 and asset.
- `manifest-VARIANT.json.sig`: an Ed25519 signature of the manifest.

Development builds add the short commit to each asset name, such as `board-abc1234.xz`, because they
share one release. The manifest names stay the same, so boards always find the newest one.

[`deploy/dietpi/managed-files.txt`](../deploy/dietpi/managed-files.txt) lists the managed files.
`install-image.sh`, `build_image.py` and `cmd/release` all read it, so the image and the updates can't
disagree about which files a board has. Required packages are in
[`deploy/dietpi/packages.txt`](../deploy/dietpi/packages.txt). Updates check for packages but don't
install them, so a release that needs a new package can only be installed by reflashing.

## How a board updates

1. The manager asks the GitHub API for the channel's release. It sends the last response's `ETag`, so
   checks that find nothing new don't count against GitHub's limit of 60 requests an hour for each IP
   address.
2. It downloads the manifest and its signature, and checks the signature with the public key built
   into `manage`.
3. It compares each managed file on the board with two manifests: the one it installed last
   (`/var/lib/departure-board/installed-manifest.json`) and the new one.
4. When someone clicks **Update now**, or a scheduled check finds an update and automatic installs are
   on, the manager downloads only the assets that contain changed files. It checks each one against
   GitHub's digest and the signed manifest, and stages the files in
   `/var/lib/departure-board/update/staged`.
5. The manager runs the new board binary with `-check-config` against the board's settings and with
   `-config-schema`. If either fails, nothing changes.
6. The manager starts `departure-board-update.service`. This root unit runs the **staged** `manage apply`,
   so the new release installs itself. It backs up the files it's about to replace, writes the new
   ones, reloads systemd, and restarts the board and the manager.
7. If either service isn't running 20 seconds later, or keeps restarting, it restores the backup and
   restarts both services again. Otherwise it records the new installed manifest.

The manager runs in a sandbox that can't write to `/opt` or `/etc/systemd`, which is why a separate
unit installs the files.

## Files edited on a board

A file stops an update when the new release changes it and it no longer matches the installed
manifest. The **Updates** tab lists each such file and shows how it differs from the new release's
version. Nothing changes until the file is put back, or the board is reflashed.

A file someone edited isn't a problem if the new release leaves it unchanged. Updates never touch
the board's own settings: `departure-board.toml`, `dietpi.txt`, `config.txt`, the web password, the
Wi-Fi network, and the root SSH keys. A manifest that lists any of them is rejected.

## Interrupted updates

`departure-board-update.service` writes `/var/lib/departure-board/update/applying` before it changes
anything, and removes it when it finishes. If the manager starts and finds that marker while the update
unit isn't running, such as after a power cut, it starts the unit again, which restores the backup.

## Set up release signing

Boards reject updates until the repository has a signing key. To create one, run this from `led-board`:

```sh
go run ./cmd/release keygen
```

The command writes the public key to `internal/update/signing.pub` and prints the private key. Store the
printed line as the `UPDATE_SIGNING_KEY` Actions secret, and commit `signing.pub`. Boards built after
that commit can check updates. A board built without the key, including one flashed with
`v0.0.0-alpha.1`, needs reflashing or the bootstrap step.

If the private key is lost or exposed, generate a new pair. Boards that have the old public key can't
check updates signed with the new one, so they need reflashing or `just bootstrap-updater`.

## Development builds in CI

The `dev-release` job in `.github/workflows/dietpi-image.yml` runs for each push to `main` that changes
the board, after the tests and both images have built. It calls
[`deploy/dietpi/publish-dev-release.sh`](../deploy/dietpi/publish-dev-release.sh), which does the
following:

1. Creates the `dev` prerelease if it doesn't exist.
2. Stops if the release already has a newer build, so a slow run can't replace a newer one.
3. Uploads the build's assets, then its manifests.
4. Deletes the assets of all but the last three builds.
5. Rewrites the release notes with the commit and a link to the changes since the previous build.

Full images from `main` aren't attached to `dev`; they stay as workflow artifacts for 14 days.

## Boards flashed with v0.0.0-alpha.1

These boards have no updater, and their manager can't install one. `manage` embeds a manifest of that
release, built from the files at its tag and the binary hashes in its `build-info.txt`. To give such a
board an updater, run:

```sh
PI_HOST=root@departureboard.local SUDO= just bootstrap-updater
```

The recipe checks that every file still matches `v0.0.0-alpha.1` and stops if any don't. Then it
installs the current `board`, `manage` and `departure-board-update.service`, and records them as
installed. The board keeps the release's build number, so the next update replaces its other files.

`v0.0.0-alpha.1` can't start its SSH server, because the image has no host key. To use the recipe, first
sign in on the board's console and run:

```sh
dropbearkey -t ed25519 -f /etc/dropbear/dropbear_ed25519_host_key
systemctl restart dropbear
```

Reflashing with a newer image is usually quicker.
