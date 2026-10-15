#!/bin/bash
# Publishes a signed development build to the rolling "dev" prerelease, which boards on the development channel
# follow. Runs in CI from led-board, with GH_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA set.
set -euo pipefail
[[ $# == 1 && -d $1 ]] || { echo 'Usage: publish-dev-release.sh DIR' >&2; exit 1; }
dir=$1
tag=dev
repo=$GITHUB_REPOSITORY

# A release created with GITHUB_TOKEN doesn't trigger release: published, so this doesn't start another build.
if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
    gh release create "$tag" --repo "$repo" --prerelease --target "$GITHUB_SHA" \
        --title 'Development build' --notes 'Boards on the development channel install the build attached here.'
fi

# A slow run of an older commit can finish after a newer one. It must not replace the newer build.
previous=$(gh release download "$tag" --repo "$repo" --pattern 'manifest-rpi234.json' --output - 2>/dev/null | jq -r '.commit // empty' || true)
if [[ $previous ]] && git cat-file -e "$previous^{commit}" 2>/dev/null && ! git merge-base --is-ancestor "$previous" "$GITHUB_SHA"; then
    echo "The dev release has $previous, which is newer than $GITHUB_SHA. Leaving it in place."
    exit 0
fi

# Each build's assets have the commit in their names, so they never replace another build's. Boards read a manifest
# before the assets it lists, so the manifests go last.
shopt -s extglob
gh release upload "$tag" --repo "$repo" --clobber -- "$dir"/!(manifest-*)
gh release upload "$tag" --repo "$repo" --clobber -- "$dir"/manifest-*

# Keep the last three builds' assets, so a board that is still downloading the previous build can finish.
old=$(gh api "repos/$repo/releases/tags/$tag" --jq '
    [.assets[] | select(.name | test("-[0-9a-f]{7}\\.(tar\\.)?xz$"))
        | . + {build: (.name | capture("-(?<sha>[0-9a-f]{7})\\.(tar\\.)?xz$").sha)}]
    | group_by(.build) | sort_by(map(.created_at) | max) | reverse | .[3:] | .[][] | .id')
for id in $old; do
    gh api --method DELETE "repos/$repo/releases/assets/$id"
done

title=$(git log -1 --format=%s "$GITHUB_SHA")
notes="Built from [\`${GITHUB_SHA::7}\`](https://github.com/$repo/commit/$GITHUB_SHA): $title"
if [[ $previous && $previous != "$GITHUB_SHA" ]]; then
    notes+=$'\n\n'"[Changes since the previous development build](https://github.com/$repo/compare/$previous...$GITHUB_SHA)"
fi
notes+=$'\n\n'"Boards on the development channel install this build. It passed CI's tests, but it hasn't been tried on a board."
gh release edit "$tag" --repo "$repo" --prerelease --title 'Development build' --notes "$notes"
