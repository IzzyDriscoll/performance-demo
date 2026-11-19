# Neutreeno Performance — prototype

A clickable prototype of the Neutreeno performance review app. It uses **made-up people only**.

## How to open it
Double-click `index.html`. It opens in your web browser. No internet or installation needed.

**Sign in:** pick who you are and enter the shared demo password. You stay signed in on that browser until you click **Sign out** (top banner). The password only keeps casual visitors out; it isn't real security, because the site has no server and its files are public on GitHub. The online version is at https://izzydriscoll.github.io/performance-demo/ (opening `index.html` straight from the folder may not be able to check the password in every browser).

Use **Viewing as** at the top right to switch between people. The made-up team mirrors the shape of the real Neutreeno org chart (November 2026). Good ones to try:
- **Maya Okafor** (Ops & Finance Lead): her own review, her team, and **All reviews** (Ops access).
- **Daniel Reyes** (CEO): direct reports plus the whole wider team, read-only.
- **Leo Marchetti** (Head of Software): see Theo's side-by-side and the logged review discussion.
- **Theo Becker** (team member): his results after the review discussion, with the meeting transcript.
- **Ryan Patel** (BDR): a role with no scorecard yet.

Use **Light / Dark** at the top to switch colour mode. Your choice is remembered; until you pick one, it follows your computer's setting.

Changes are saved in your browser only. **Reset demo data** (top banner) puts everything back to the start.

## What's in the folder
| File | What it is |
|---|---|
| `index.html` | The page you open |
| `app.js` | How the app behaves (screens, grading, buttons) |
| `styles.css` | How it looks: colours, fonts and shapes from the *Neutreeno Design System* |
| `theme.js` | The light / dark mode switch |
| `gate.js` | The sign-in screen's shared password (stored scrambled, never in plain text) |
| `assets/` | Neutreeno logos (white wordmark in the menu, dot mark as the browser-tab icon) |
| `data/framework.js` | Scorecard wording and talent bar, taken from *Neutreeno Performance Review Scorecard.xlsx* and *Talent Bar v8* |
| `data/demo-data.js` | The made-up people, reviews, goals and 1:1s |

## Review cycle
- Self-review and team lead review are both due on **7 Feb** (and 7 Aug).
- The review discussion is due on **14 Feb** (and 14 Aug). The team lead logs it with notes and the meeting transcript; results then appear for the employee.

## Who can see what
- **Everyone** sees their own self-review, and their team lead's review of them after the review discussion, along with the notes and transcript.
- **Direct team lead** writes the team lead review, sees the self-review once they've submitted their own, and logs the review discussion.
- **Anyone higher up the tree** can read submitted reviews for everyone below them, but can't write them or log discussions.
- **Ops access** (Ops & Finance Lead and Ops Specialist) can read every submitted review, to run the cycle.
- Nobody else. Colleagues at the same level, or in other teams, see nothing.

## Grading rules
- Each line is rated Poor → Basic → Intermediate → Advanced → Exceptional.
- Section grade = average of its lines, rounded to the nearest level.
- Area grade (Culture, Deliverables, Skills) = average of its section grades, rounded.
- Compared with the talent bar for the person's seniority: below = Underperformer, at = Above the Bar, above = A-player.
- Overall: Underperformer if any area is below the bar; A-player if two or more areas are above; otherwise Above the Bar.
