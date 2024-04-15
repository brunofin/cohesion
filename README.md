# Cohesion
Cohesion is a Notion Linux client built with Electron. As Notion doesn't compile the official app for Linux, here is an unofficial build.

Forked from the project [WhatsApp Desktop for Linux (unofficial)](https://github.com/mimbrero/whatsapp-desktop-linux) and modified to make it work with Notion.

## 📜 Disclaimer
This just loads https://notion.so/ with some extra features, but never changing the content of the official webpage (html, css nor javascript). Linux users just can't install any official app, and Cohesion is running the official web client.

This wrapper is not verified by, affiliated with, or supported by Notion Inc.

## 🪲 Known Issues
- Can't login with OAuth yet, authentication need to be done by temporary Notion login code.
- Links to Notion opened from external apps are not redirected to Notion Desktop yet.

## 💾 Installation
### 🖱️✔️ Recommended: Flathub
The official Flatpak build is updated instantly after every update.

<a href="https://flathub.org/apps/details/io.github.brunofin.Cohesion"><img src="https://flathub.org/assets/badges/flathub-badge-en.png" width="250"></a>

### Browser extensions
Use the browser extension to open Notion links shared in 3rd party apps such as Slack, directly in the Cohesion desktop app. Their source code is also included in this repository.

<a href="https://addons.mozilla.org/en-US/firefox/addon/cohesion-redirector/"><img src="https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png" width="172" height="60"></a>

## :hammer: CLI arguments
- `--start-hidden`: starts Cohesion hidden in tray.

## :construction: Development
PR and forks are welcome!

1. Clone the repo
```bash
git clone https://github.com/brunofin/cohesion.git
cd cohesion
```

2. Install dependencies
```bash
npm install
```

3. Run or build
```bash
npm start # compile and run
npm run build # compile and build
```

