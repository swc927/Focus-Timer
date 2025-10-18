# Focus Timer by SWC

Enhanced focus timer with accurate ticking, glow aesthetic, notifications, sound volume, title time, auto pause when hidden, CSV export, PWA offline support.

## Features
- Accurate timer with drift correction
- Animated glow background without flicker
- Focus, Short break, Long break with configurable lengths
- Long break after N focus sessions configurable
- Auto start next session option
- Optional chime with volume control
- Desktop notifications opt in only on click
- Keyboard shortcuts Space start or pause, R reset, Arrows adjust minutes, T toggle title time
- Local storage for preferences and stats
- Stats CSV export
- PWA manifest and offline caching via service worker

## Develop
Just open index.html in a browser. For service worker to register, serve over HTTP on localhost or any HTTPS host.

## Deploy
- Any static hosting like Netlify or GitHub Pages will work.
- Upload these files as is.
