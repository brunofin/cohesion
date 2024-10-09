#!/bin/bash
DIR=$(dirname "$0")

GENERATOR_PATH="$DIR/flatpak-builder-tools/node"
LOCK_FILE="$DIR/../yarn.lock"
OUTPUT="$DIR/flathub-manifest/generated-sources.json"

pipx install $GENERATOR_PATH
flatpak-node-generator yarn $LOCK_FILE -o $OUTPUT
