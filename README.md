# Focus Timer by SWC

A slick focus timer with animated gradient background and glowy UI. Three modes Focus, Short break, Long break with keyboard shortcuts, stats, optional sound, and notifications. No frameworks.

## Features
- Animated gradient background with flowing motion
- Circular progress ring and linear progress bar
- Focus, short break, long break modes with custom minutes
- Auto start next session option
- Keyboard shortcuts Space start or pause, R reset, Arrow keys adjust minutes
- Soft chime on session end using Web Audio API
- Desktop notifications optional
- Local storage for preferences and lightweight stats today count, day streak, total minutes
- Fully client side single page

## Files
- `index.html` structure and components
- `styles.css` glow aesthetic and animations
- `app.js` timer logic, settings, notifications, sound
- `README.md` this file

## Run locally
Just open `index.html` in a browser.

Or run a static server if you prefer:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploy on GitHub Pages
1. Create a new repository on GitHub named `glowtimer-swc` or any name you like.
2. Push the files from your local machine see steps below.
3. In the repository settings go to Pages and pick branch `main` and folder `/root` then save.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit GlowTimer by SWC"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Notes
- The moving colour background effect is an animated gradient driven by CSS keyframes. Tweak `@keyframes gradientFlow` and `background` in `styles.css` if you want different motion.
- If notifications do not appear, click Enable notifications in the footer then allow the permission prompt.
- Sound uses Web Audio and will only play after a user gesture in some browsers.
