# acamaro.com

Personal site of Acamaro Cutcher: research, interactive projects and CV. Plain HTML, CSS and JavaScript,
served by GitHub Pages from the `main` branch. There is no build step.

## Layout

```
index.html            home page: featured work, research, about, recognition, contact
cv.html               CV (prints cleanly; the PDF is files/cv_acamaro_cutcher.pdf)
404.html              shown by GitHub Pages for any missing URL
css/main.css          shared styles and color variables
css/theme.css         dark-mode overrides
css/cv.css            CV page, including print styles
js/theme-init.js      runs in <head>: applies the saved or system theme before the page paints
js/main.js            theme toggle, mobile menu, scroll reveal
projects/             the Projects & Papers library and the interactive projects
  catalog.js          the one file to edit when adding a project (see projects/ADDING_A_PROJECT.md)
  cascadia/           Cascadia earthquake visualizations
  forest-park-wildfires/   Forest Park wildfire study and WRF-SFIRE handbook
  fortran-firetec/    Fortran for FIRETEC course
papers/  files/  images/   PDFs and the profile photo
sitemap.xml  robots.txt  CNAME  .nojekyll
```

## Preview locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Check the site at phone width and in both themes before pushing.

## Common edits

- **Add a project or paper to the library:** edit `projects/catalog.js`. See `projects/ADDING_A_PROJECT.md`.
- **Feature a project on the home page:** copy a `work-card` block in the "Featured work" section of `index.html`.
- **Add a research project to the home page:** copy a `research-item` block in the "Research" section of
  `index.html`, and add the same project to `projects/catalog.js`.
- **Update the CV:** edit `cv.html` and replace `files/cv_acamaro_cutcher.pdf`. Keep the two in agreement.
- **Colors:** the variables at the top of `css/main.css` (light) and `css/theme.css` (dark).
- **New page:** add its URL to `sitemap.xml`.

## Theme

The site follows the visitor's operating-system theme until they use the toggle. The choice is stored under
the `quake-viz-theme` key in `localStorage`, the same key the interactive projects use, so one choice covers
the whole site.

## Updating the interactive projects

The Cascadia and Forest Park pages are generated in separate folders and copied here. Do not edit the copies
under `projects/` by hand; a later copy would overwrite the edits. See the end of
`projects/ADDING_A_PROJECT.md`.
