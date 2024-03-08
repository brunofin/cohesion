# Cohesion

Cohesion is an unofficial Notion client for Linux, developed using Electron. Since Notion does not offer an official app for Linux users, Cohesion provides an alternative solution.

## Disclaimer

Cohesion functions as a wrapper for https://notion.so/, maintaining the integrity of the official webpage (html, css, and javascript). It's important to note that Cohesion is not endorsed, affiliated with, or supported by Notion Inc.

## Known Issues

While Cohesion aims to provide a seamless Notion experience on Linux, there are some known issues that users should be aware of:

- Currently, OAuth login is not supported. Users must authenticate using temporary Notion login codes.
- Links to Notion from external applications do not automatically open in Cohesion.

## Installation

### Recommended Method: Flathub

The easiest way to install Cohesion is through Flathub, where the official Flatpak build is maintained and updated promptly after each release.

[![Flathub Badge](https://flathub.org/assets/badges/flathub-badge-en.png)](https://flathub.org/apps/details/io.github.brunofin.Cohesion)

Manifest: [https://github.com/flathub/io.github.brunofin.Cohesion](https://github.com/flathub/io.github.brunofin.Cohesion)

## CLI Arguments

Cohesion supports command-line arguments to customize its behavior:

- `--start-hidden`: Launches Cohesion in a hidden state, accessible from the system tray.

## Development

Contributions to Cohesion are welcome! If you'd like to get involved, follow these steps to set up the development environment:

1. Clone the repository
```bash
git clone https://github.com/brunofin/cohesion.git
cd cohesion
```

2. Install dependencies
```bash
npm install
```

3. Run or build the project
```bash
npm start # Compile and run
npm run build # Compile and build
```

Feel free to submit pull requests and contribute to the improvement of Cohesion!


