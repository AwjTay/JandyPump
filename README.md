# 🥊 JandyPump

Jazz & Andy's workout tracker: an installable Android web app (PWA) with an 80s synthwave look and a training-montage feel.

- **No server, no database, no build step.** It's plain HTML/CSS/JS, hosted free on GitHub Pages.
- **Works offline at the gym.** Data is saved on the phone first.
- **Syncs between both phones** through one private GitHub Gist.

## Features

| Tab | What it does |
|---|---|
| 🎲 **Plan** | Pick a focus (Legs, Arms, Back, Core, Chest, Shoulders, or a mix). Then hit **Randomise** to generate a workout. Lock the ones you like, re-roll the rest, and tweak sets × reps. You can also browse the 60-exercise library and add your own. |
| 🥊 **Log** | Start a session from the plan or from scratch. It's timestamped automatically (you can edit the time) and has a live timer. Toggle whether it's **Jazz's** or **Andy's** workout. Log reps and kg per set and tick off finished sets. It shows what that person lifted last time. The History list has filter, edit and delete. |
| 📈 **Stats** | Sessions and kg moved this month for each person. Progress graphs show **both of you on the same chart** for any exercise (top weight, best reps or volume), plus personal bests and sessions per week. |
| 🏆 **Goals** | Monthly goals for each person: number of sessions, a weight to hit on a lift, reps in one set, or total kg moved. Progress bars show how close you are, and you get a 🏆 CHAMP badge when you hit one. You can copy last month's goals forward. |
| ⚙ **Settings** | Sync setup, JSON export/import backup, and install help. |

## Deploy (about 5 minutes)

1. Create a new GitHub repo (e.g. `jandypump`). It can be private if you have GitHub Pro; otherwise make it public. Your workout *data* never goes in the repo either way.
2. Push this folder to the repo's `main` branch. Include the hidden `.github` folder.
3. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. The included workflow (`.github/workflows/pages.yml`) deploys on every push to `main`. Your app goes live at `https://<you>.github.io/jandypump/`.

## Install on Android

Open the URL in **Chrome**, tap **⋮ → Add to Home screen / Install app**, and do this on both phones. It then opens full-screen like a native app.

## Set up sync between both phones

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate**. Give it **Account permissions → Gists: Read and write** and nothing else. (A classic token with only the `gist` scope also works.)
2. On phone 1, open **⚙ Settings**, paste the token and tap **Create sync gist**. A Gist ID appears.
3. On phone 2, open **⚙ Settings** and paste the **same token and Gist ID**, then tap **Save & sync**.

The app syncs when it opens, after you save something, and when you tap ⟳. The two phones' records are merged one by one, with the newest edit winning, so logging on both phones at once is fine. The token stays on your phones (in browser storage) and only grants access to gists, so keep it between the two of you.

## Customising

- **Exercises:** edit `js/exercises.js` (name, group, default sets/reps). You can also add your own in-app under Plan → Exercise library.
- **Names and colours:** `PEOPLE` in `js/exercises.js` (Jazz = hot pink, Andy = cyan).
- **Theme:** CSS variables at the top of `css/style.css`.
- **Icons** are drawn by `scripts/make_icons.py` during each deploy, so the repo stays text-only. To run the app locally, first run `python3 scripts/make_icons.py icons` (needs Pillow), then `python3 -m http.server`.
- **After you change files**, bump `VERSION` in `sw.js` so phones pick up the new version straight away.

## File map

```
index.html              app shell
css/style.css           synthwave theme
js/app.js               UI & screens
js/exercises.js         exercise library + people
js/store.js             local storage + merge logic
js/sync.js              GitHub Gist sync
js/chart.js             tiny SVG chart (no libraries)
sw.js                   offline cache
scripts/make_icons.py   draws the app icons at deploy time
manifest.webmanifest    Android install metadata
.github/workflows/      GitHub Pages deploy (generates icons, publishes the site)
```
