# Adding a project to acamaro.com/projects/

The Projects & Papers page (`projects/index.html`) is built from **one file: `projects/catalog.js`**.
You never edit the page's HTML to add work. Add an entry to the catalog and the page creates the card,
section, filters and counts on its own.

## Folder layout

```
projects/
├── index.html          the library page (acamaro.com/projects/)
├── catalog.js          ← edit this: the list of fields, types and projects
├── library.js          renders the page (no edits needed)
├── library.css         styles (uses the site's colors and dark mode)
├── thumbs/             optional preview images, one per project
│   └── cascadia.jpg
└── cascadia/           a self-contained interactive project
    └── index.html
```

Where things go:

| Kind of work | Put the files in | Link it in catalog.js as |
|---|---|---|
| Interactive tool or visualization | `projects/<short-name>/` (its own `index.html`) | `"<short-name>/index.html"` |
| Paper / thesis PDF | `papers/` (site root) | `"../papers/<file>.pdf"` |
| External paper, repo, Drive file | nowhere | the full `https://…` URL |

Use lowercase, hyphenated folder names (`projects/heat-equation/`). The folder name becomes the URL.

## Add an entry

Copy this into the `projects: [ … ]` list in `catalog.js`. Put new work at the top, because the list runs
newest first.

```js
{
  id: 'heat-equation',                       // unique, lowercase; also lets you link to projects/#heat-equation
  title: 'Visualizing the Heat Equation',
  summary: 'One or two sentences on what it is and why it matters.',
  disciplines: ['math', 'physics'],          // first one = the section it appears in
  types: ['interactive', 'code'],            // any of: interactive, paper, research, code, video
  status: 'completed',                       // 'completed' or 'current' (optional)
  year: 2026,                                // optional
  featured: false,                           // true = wide card with the image beside the text
  thumb: 'thumbs/heat-equation.jpg',         // optional; without it a colored icon tile is shown
  tags: ['PDEs', 'JavaScript'],
  links: [
    { label: 'Explore', href: 'heat-equation/index.html', icon: 'fa-arrow-right', primary: true },
    { label: 'Code', href: 'https://github.com/AcamaroCutcher/heat-equation', icon: 'fa-github', brand: true },
    { label: 'Paper (PDF)', href: '../papers/2026-heat-equation.pdf', icon: 'fa-file-pdf' },
  ],
},
```

- **Icons** are Font Awesome 6 names (https://fontawesome.com/search?ic=free). Brand icons such as `fa-github`
  and `fa-google-drive` need `brand: true`.
- **The primary link** gets the filled button, and the card's title and image link to it.
- **Thumbnails** look best at about 1600×700 (wide) or square for featured cards. JPG, under 200 KB.

## Add a new field (e.g. Geology on its own)

Add it to `disciplines` in `catalog.js`. Order there is the order of sections on the page:

```js
{ id: 'geology', name: 'Geology', icon: 'fa-mountain', blurb: 'Rocks, faults and deep time.' },
```

To give it its own card colors, add one line to `library.css` next to the others:

```css
.lib-art-geology { --a: #92400e; --b: #d97706; }
.lib-field-geology { color: #92400e; }  .dark-mode .lib-field-geology { color: #fbbf24; }
```

Without that line it falls back to the site's blue and purple, which also works.
A field with no projects yet is hidden automatically.

## Link to a filtered view

The filters live in the URL, so you can link to any view:

- `projects/index.html?field=physics`: physics only
- `projects/index.html?type=paper`: all papers (the footer's "Publications" link uses this)
- `projects/index.html?type=interactive`: all interactive tools
- `projects/index.html?q=plasmon`: search
- `projects/index.html#cascadia`: scroll to one card

## Check before you push

Open `projects/index.html` in a browser (double-clicking the file works) and check that the new card appears
in the right section. Then open the browser console: typos in a `disciplines` or `types` id are reported there.

## Updating the Cascadia visualizations

They are developed in a separate folder (`earth_quake_prediction/viz`). To copy a new version here:

```sh
sh ../earth_quake_prediction/viz/tools/deploy-to-site.sh
```
