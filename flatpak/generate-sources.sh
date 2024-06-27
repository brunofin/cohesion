#!/bin/bash
DIR=$(dirname "$0")

GENERATOR_PATH="$DIR/flatpak-builder-tools/node"
LOCK_FILE="$DIR/../package-lock.json"
OUTPUT="$DIR/generated-sources.json"

pipx install $GENERATOR_PATH
flatpak-node-generator npm $LOCK_FILE -o $OUTPUT
