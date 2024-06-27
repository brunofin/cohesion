#!/bin/bash

rm -rf build
mkdir build
cp -r src build/chrome
cp -r src build/firefox
rm -rf build/chrome/firefox
rm -rf build/firefox/chrome
mv build/chrome/chrome/manifest.json build/chrome
mv build/firefox/firefox/manifest.json build/firefox
rm -rf build/chrome/chrome
rm -rf build/firefox/firefox
cd build/chrome
pwd
zip -r chrome.zip *
cd ../..
cd build/firefox
zip -r -Z deflate -1 firefox.zip *
cd ../..
rm -rf dist
mkdir dist
mv build/chrome/chrome.zip dist/chrome.zip
mv build/firefox/firefox.zip dist/firefox.zip
rm -rf build