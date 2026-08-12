#!/usr/bin/env bash
set -euo pipefail

REPO="DarthTigerson/Huginn"

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin)
    if [ "$arch" != "arm64" ]; then
      echo "Huginn only ships an Apple Silicon (arm64) build right now — Intel Macs aren't supported yet." >&2
      echo "Track it at https://github.com/$REPO/issues" >&2
      exit 1
    fi

    url="https://github.com/$REPO/releases/latest/download/Huginn-arm64.zip"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT

    echo "Downloading Huginn..."
    curl -fsSL "$url" -o "$tmp/Huginn.zip"

    echo "Installing to /Applications..."
    unzip -q "$tmp/Huginn.zip" -d "$tmp"

    # Swap the new app into place without ever leaving /Applications without
    # a working Huginn.app: the old bundle is renamed aside first and only
    # deleted once the new one is successfully in place, restoring it if the
    # move fails partway through (e.g. disk full).
    cat > "$tmp/swap.sh" <<'SWAP'
#!/usr/bin/env bash
set -euo pipefail
new_app="$1"
backup="/Applications/.Huginn.app.bak"
rm -rf "$backup"
if [ -e /Applications/Huginn.app ]; then
  mv /Applications/Huginn.app "$backup"
fi
if mv "$new_app" /Applications/Huginn.app; then
  xattr -cr /Applications/Huginn.app
  rm -rf "$backup"
else
  rm -rf /Applications/Huginn.app
  if [ -e "$backup" ]; then
    mv "$backup" /Applications/Huginn.app
  fi
  exit 1
fi
SWAP
    chmod +x "$tmp/swap.sh"

    # /Applications is root:admin 775 — only writable by admins. Try
    # unprivileged first (covers standing admins); if that's not possible,
    # ask macOS for a one-off admin authorization (password/Touch ID) rather
    # than deleting the existing install and hoping. If the user has no
    # admin rights available (e.g. their temporary-admin grant has expired),
    # this fails and exits before anything is touched, so the existing
    # install is left intact and they can retry after re-requesting admin.
    if [ -w /Applications ]; then
      "$tmp/swap.sh" "$tmp/Huginn.app"
    else
      echo "Administrator rights are required to update Huginn in /Applications."
      shell_cmd="$(printf '%q %q' "$tmp/swap.sh" "$tmp/Huginn.app")"
      # Escape for embedding in an AppleScript double-quoted string literal.
      osa_cmd="${shell_cmd//\\/\\\\}"
      osa_cmd="${osa_cmd//\"/\\\"}"
      if ! osascript -e "do shell script \"$osa_cmd\" with administrator privileges" >/dev/null; then
        echo "Update cancelled: administrator rights are required." >&2
        echo "Request admin access and re-run the update." >&2
        exit 1
      fi
    fi

    if [ -z "${HUGINN_NO_LAUNCH:-}" ]; then
      echo "Huginn installed. Launching..."
      open /Applications/Huginn.app
    else
      echo "Huginn installed."
    fi
    ;;

  Linux)
    if [ "$arch" != "x86_64" ]; then
      echo "Huginn only ships an x86_64 Linux build right now." >&2
      echo "Track it at https://github.com/$REPO/issues" >&2
      exit 1
    fi

    url="https://github.com/$REPO/releases/latest/download/Huginn-x64.tar.gz"
    install_dir="$HOME/.local/share/huginn"
    bin_dir="$HOME/.local/bin"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT

    echo "Downloading Huginn..."
    curl -fsSL "$url" -o "$tmp/Huginn.tar.gz"

    echo "Installing to $install_dir..."
    rm -rf "$install_dir"
    mkdir -p "$install_dir" "$bin_dir" "$HOME/.local/share/applications"
    tar -xzf "$tmp/Huginn.tar.gz" -C "$install_dir"
    ln -sf "$install_dir/huginn" "$bin_dir/huginn"

    cat > "$HOME/.local/share/applications/huginn.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Huginn
Exec=$install_dir/huginn
Icon=$install_dir/resources/icon.png
Categories=Development;
EOF

    echo "Huginn installed to $install_dir"
    case ":$PATH:" in
      *":$bin_dir:"*) echo "Run 'huginn' to launch it, or find it in your application menu." ;;
      *) echo "$bin_dir isn't on your PATH — launch Huginn from your application menu, or add $bin_dir to PATH to run 'huginn' directly." ;;
    esac
    ;;

  *)
    echo "Unsupported OS: $os" >&2
    exit 1
    ;;
esac
