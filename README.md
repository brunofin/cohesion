# Notion Desktop for Linux (unofficial)
Notion Linux client built with Electron. As Notion doesn't compile the official app for Linux, here is an unofficial build.

Forked from the project [WhatsApp Desktop for Linux (unofficial)](https://github.com/mimbrero/whatsapp-desktop-linux) and modified to make it work with Notion.

## 📜 Disclaimer
This just loads https://notion.so/ with some extra features, but never changing the content of the official webpage (html, css nor javascript). Linux users just can't install any official app, and notion-deskop-linux is running the official web client.

This wrapper is not verified by, affiliated with, or supported by Notion Inc.

## 🪲 Known Issues
- Can't login with OAuth yet, authentication need to be done by temporary Notion login code.
- Links to Notion opened from external apps are not redirected to Notion Desktop yet.

## 💾 Installation
### 🖱️✔️ Recommended: Flathub
The official Flatpak build is updated instantly after every update.

<a href="https://flathub.org/apps/details/io.github.brunofin.NotionAppDesktop"><img src="https://flathub.org/assets/badges/flathub-badge-en.png" width="250"></a>

## :hammer: CLI arguments
- `--start-hidden`: starts Notion hidden in tray.

## :construction: Development
PR and forks are welcome!

1. Clone the repo
```bash
git clone https://github.com/brunofin/notion-desktop-linux.git
cd notion-desktop-linux
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
