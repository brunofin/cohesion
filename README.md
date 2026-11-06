# Cohesion

Cohesion is an unofficial Notion client for Linux, developed using Electron. Since Notion does not offer an official app for Linux users, Cohesion provides an alternative solution.

## Disclaimer

Cohesion functions as a wrapper for https://notion.so/, maintaining the integrity of the official webpage (html, css, and javascript). It's important to note that Cohesion is not endorsed, affiliated with, or supported by Notion Inc.

## Known Issues

While Cohesion aims to provide a seamless Notion experience on Linux, there are some known issues that users should be aware of:

- Currently, OAuth login is not supported. Users must authenticate using temporary Notion login codes.
- Support multiple tabs.

## Installation

### Recommended Method: Flathub

The easiest way to install Cohesion is through Flathub, where the official Flatpak build is maintained and updated promptly after each release.

[![Flathub Badge](https://flathub.org/assets/badges/flathub-badge-en.png)](https://flathub.org/apps/details/io.github.brunofin.Cohesion)

Manifest: [https://github.com/flathub/io.github.brunofin.Cohesion](https://github.com/flathub/io.github.brunofin.Cohesion)

### Arch Linux users: AUR

There is also a community-maintained package on the Arch Linux User Repository (AUR): [`cohesion-git`](https://aur.archlinux.org/packages/cohesion-git)

### Browser extensions
Use the browser extension to open Notion links shared in 3rd party apps such as Slack, directly in the Cohesion desktop app. Their source code is also included in this repository.

<a href="https://chromewebstore.google.com/detail/cohesion-redirector/nloncahmhbajbhmodfcmjndgmdknmimo"><img src="https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png" width="206" height="58"></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/cohesion-redirector/"><img src="https://extensionworkshop.com/assets/img/documentation/publish/get-the-addon-178x60px.dad84b42.png" width="172" height="60"></a>

## CLI Arguments

Cohesion supports command-line arguments to customize its behavior:

- `--start-hidden`: Launches Cohesion in a hidden state, accessible from the system tray.
- `--disable-spellcheck`: Disables spellcheck in the editor. In the future, users will be able to do that through the app settings, and select multiple languages.

## Development

Contributions to Cohesion are welcome! If you'd like to get involved, follow these steps to set up the development environment:

1. Clone the repository
```bash
git clone https://github.com/brunofin/cohesion.git
cd cohesion
```

2. Install dependencies
```bash
yarn install
```

3. Run or build the project
```bash
yarn start # Compile and run
yarn run build # Compile and build
```

### Flatpak

Generate the offilne dependencies with

```bash
yarn run flatpak:generate-sources
```

Feel free to submit pull requests and contribute to the improvement of Cohesion!

<!-- funding:start -->
## Support

If this project is useful to you, please consider supporting my open-source work.

[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-Sponsor-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/brunofin)

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/brunofin)

[![Wise](https://img.shields.io/badge/Wise-Donate-9FE870?style=for-the-badge&logo=wise&logoColor=163300)](https://wise.com/pay/me/brunof24)

[![Pix](https://img.shields.io/badge/Pix-Donate-32BCAD?style=for-the-badge&logo=pix&logoColor=white)](https://nubank.com.br/cobrar/3164y/6ae4922e-9b97-4445-ba66-3cbcd0bd74a3)
<!-- funding:end -->
