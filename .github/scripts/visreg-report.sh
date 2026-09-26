#!/usr/bin/env bash
# Compares the board screenshots at two commits and writes a pull request comment, with an image for each changed
# screenshot that shows the differing pixels in magenta.
#
# Usage: visreg-report.sh <base commit> <head commit> <output directory>
#
# Run it from the repository root, with IMAGEDIFF naming a build of led-board/cmd/imagediff, REPOSITORY naming the
# GitHub repository, and IMAGE_URL naming the URL that the output directory's images/ folder will be published at.
# It writes images/ and comment.md to the output directory, and prints the number of screenshots that changed.
set -euo pipefail

base=$1
head=$2
out=$3
dirs=(website/tests/visual/baselines led-board/internal/formats/testdata/golden)
# GitHub rejects a comment longer than 65,536 characters, which is about this many images.
max_shown=60

raw() { echo "https://raw.githubusercontent.com/$REPOSITORY/$1/$2"; }

mkdir -p "$out/images"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

changed=() pixels=() added=() removed=() resized=()

while IFS=$'\t' read -r status path; do
  case $status in
    A) added+=("$path") ;;
    D) removed+=("$path") ;;
    M)
      git show "$base:$path" >"$scratch/before.png"
      git show "$head:$path" >"$scratch/after.png"
      mkdir -p "$out/images/$(dirname "$path")"
      result=$("$IMAGEDIFF" "$scratch/before.png" "$scratch/after.png" "$out/images/$path")
      # A screenshot can be re-encoded without any visible change, which isn't worth a reviewer's attention.
      if [[ $result == size ]]; then
        resized+=("$path")
      elif ((result > 0)); then
        changed+=("$path")
        pixels+=("$result")
      fi
      ;;
  esac
done < <(git diff --name-status --no-renames "$base" "$head" -- "${dirs[@]}")

total=$((${#changed[@]} + ${#added[@]} + ${#removed[@]} + ${#resized[@]}))
name() { basename "$1" .png; }
shown=0

# Past the limit, a screenshot is listed by name instead of shown.
heading() {
  echo
  if ((shown++ >= max_shown)); then
    echo "- \`$(name "$1")\` $2"
    return 1
  fi
  echo "### \`$(name "$1")\` $2"
  echo
}

img() { echo "<img alt=\"$1\" src=\"$2\">"; }

{
  echo '<!-- visreg-report -->'
  echo '## Board screenshot changes'
  echo
  if ((total == 0)); then
    echo "No board screenshots differ from the base branch as of \`$head\`."
  else
    echo "$total board screenshots differ from the base branch as of \`$head\`. Changed pixels are magenta."
  fi

  for i in "${!changed[@]}"; do
    path=${changed[i]}
    heading "$path" "(${pixels[i]} pixels differ)" || continue
    img Differences "$IMAGE_URL/$path"
    echo
    echo '<details><summary>Before and after</summary>'
    echo
    img Before "$(raw "$base" "$path")"
    img After "$(raw "$head" "$path")"
    echo
    echo '</details>'
  done

  for path in "${resized[@]}"; do
    heading "$path" '(changed size)' || continue
    img Before "$(raw "$base" "$path")"
    img After "$(raw "$head" "$path")"
  done

  for path in "${added[@]}"; do
    heading "$path" '(new)' || continue
    img 'New screenshot' "$(raw "$head" "$path")"
  done

  for path in "${removed[@]}"; do
    echo
    echo "- \`$(name "$path")\` (removed)"
  done
} >"$out/comment.md"

echo "$total"
