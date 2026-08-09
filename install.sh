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
    rm -rf "/Applications/Huginn.app"
    mv "$tmp/Huginn.app" /Applications/

    # Belt and suspenders: curl downloads aren't quarantined by Gatekeeper the
    # way browser downloads are, but strip any quarantine flag just in case.
    xattr -cr /Applications/Huginn.app

    echo "Huginn installed. Launching..."
    open /Applications/Huginn.app
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
