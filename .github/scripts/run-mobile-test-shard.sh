#!/usr/bin/env bash
set -euo pipefail

part="${1:?part is required}"
total="${2:?total is required}"
subpart="${3:-0}"
subtotal="${4:-1}"

mapfile -t tests < <(find mobile/test -maxdepth 1 -name '*.test.mjs' | sort)
n=${#tests[@]}
size=$(( (n + total - 1) / total ))
base_start=$(( part * size ))

if (( base_start >= n )); then
  echo "No mobile tests assigned to shard $((part + 1))/$total"
  exit 0
fi

base_count=$size
if (( base_start + base_count > n )); then
  base_count=$(( n - base_start ))
fi

subsize=$(( (base_count + subtotal - 1) / subtotal ))
start=$(( base_start + subpart * subsize ))
end=$(( base_start + base_count ))
if (( start >= end )); then
  echo "No mobile tests assigned to subshard $((subpart + 1))/$subtotal of shard $((part + 1))/$total"
  exit 0
fi
count=$subsize
if (( start + count > end )); then
  count=$(( end - start ))
fi

chunk=("${tests[@]:start:count}")
printf 'Shard %d/%d subshard %d/%d: %s\n' "$((part + 1))" "$total" "$((subpart + 1))" "$subtotal" "${chunk[*]}"

for test_file in "${chunk[@]}"; do
  git restore .
  git clean -fd
  echo "Running ${test_file}"
  node --test "${test_file}"
done
