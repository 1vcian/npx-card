// Everything personal lives in this file. To make the card yours, edit it and
// nothing else (then rename the package in package.json and publish).

export const profile = {
  name: "Lucian Medrihan",
  title: "Software Engineer",
  place: "Rome, Italy",

  // One sentence; the card wraps it next to the logo.
  pitch: "Code that actually ships, from satellite imagery pipelines to the games in your pocket.",

  // The logo, drawn with block characters, and a plain-ASCII fallback for
  // terminals that cannot show them. "1v" is how the nickname 1vcian spells "Lu".
  logo: [
    " ▄██   ██    ██",
    "▀▀██   ██    ██",
    "  ██   ▀█▄  ▄█▀",
    "  ██    ▀█▄▄█▀ ",
    "▄▄██▄▄   ▀██▀  ",
  ],
  logoAscii: [
    " _         ",
    "/ |_   __  ",
    "| \\ \\ / /  ",
    "| |\\ V /   ",
    "|_| \\_/    ",
  ],

  // label, text shown, link opened on click (in terminals that support links).
  // They are laid out two per row when they fit.
  facts: [
    ["web", "1vcian.me", "https://1vcian.me"],
    ["code", "github.com/1vcian", "https://github.com/1vcian"],
    ["in", "linkedin.com/in/lume", "https://linkedin.com/in/lume"],
    ["mail", "medrihanlucian@gmail.com", "mailto:medrihanlucian@gmail.com"],
  ],

  // The menu under the card, shown in two columns (first half on the left).
  // An entry opens a `url`, or runs something built in: "game".
  // `copy` also puts a text in the clipboard.
  actions: [
    { label: "Open my website", hint: "1vcian.me", url: "https://1vcian.me" },
    { label: "See my projects", hint: "on my portfolio, 1vcian.me/Portfolio", url: "https://1vcian.me/Portfolio/#projects" },
    { label: "Download my résumé", hint: "one page, PDF", url: "https://1vcian.me/Portfolio/resume.pdf" },
    { label: "Email me", hint: "medrihanlucian@gmail.com", url: "mailto:medrihanlucian@gmail.com", copy: "medrihanlucian@gmail.com" },
    { label: "Browse my code", hint: "github.com/1vcian", url: "https://github.com/1vcian" },
    { label: "Connect on LinkedIn", hint: "linkedin.com/in/lume", url: "https://linkedin.com/in/lume" },
    { label: "Play ORBIT RUN", hint: "a small game: dodge the debris, catch the packets", run: "game" },
    { label: "Take this card", hint: "github.com/1vcian/npx-card: it is open source", url: "https://github.com/1vcian/npx-card" },
  ],

  bye: "Thanks for stopping by. Ciao!",

  // Shown to whoever flies far enough in the game.
  contact: "medrihanlucian@gmail.com",
};
