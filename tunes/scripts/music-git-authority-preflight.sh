#!/bin/sh
set -eu

repository_root=$1
git_path=$2
shift 2
cd -- "$repository_root"

for authority in "$@"; do
  tag=$("$git_path" --no-replace-objects ls-files -v -- "$authority")
  case "$tag" in
    [a-z]*|S*) printf '%s\n' 'trusted native release source authority is unavailable' >&2; exit 78 ;;
  esac
  committed=$("$git_path" --no-replace-objects rev-parse "HEAD:$authority" 2>/dev/null) || {
    printf '%s\n' 'trusted native release source authority is unavailable' >&2; exit 78;
  }
  current=$("$git_path" --no-replace-objects hash-object -- "$authority")
  if [ "$committed" != "$current" ]; then
    printf '%s\n' 'trusted native release source authority is unavailable' >&2
    exit 78
  fi
done
