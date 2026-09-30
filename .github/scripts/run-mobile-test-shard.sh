#!/usr/bin/env bash
set -euo pipefail

part="${1:?part is required}"
total="${2:?total is required}"

mapfile -t tests < <(find mobile/test -maxdepth 1 -name '*.test.mjs' | sort)
n=${#tests[@]}
size=$(( (n + total - 1) / total ))
start=$(( part * size ))

if (( start >= n )); then
  echo "No mobile tests assigned to shard $((part + 1))/$total"
  exit 0
fi

chunk=("${tests[@]:start:size}")
printf 'Shard %d/%d: %s\n' "$((part + 1))" "$total" "${chunk[*]}"

for test_file in "${chunk[@]}"; do
  git restore .
  git clean -fd
  echo "Running ${test_file}"
  node --test "${test_file}"
done
