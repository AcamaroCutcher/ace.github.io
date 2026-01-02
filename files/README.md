# Files Directory

Place downloadable files in this directory.

## Required Files

### CV/Resume PDF
- **File**: `YourName_CV.pdf` (rename with your actual name)
- **Format**: PDF
- **Size**: Keep under 5MB
- **Description**: Your curriculum vitae for download

Update the link in `cv.html` (line ~40):
```html
<a href="files/YourName_CV.pdf" download class="btn btn-primary">
```

## Optional Files

### Research Papers
- If you prefer local hosting over Google Drive
- Place papers here: `paper1.pdf`, `thesis.pdf`, etc.
- Link from research project pages

### Presentations
- Conference slides: `presentation-icml-2024.pdf`
- Posters: `poster-research-conference.pdf`

### Data Files
- Datasets (if small enough)
- Supplementary materials
- Code archives

### Other Documents
- Transcripts
- Certificates
- Portfolio pieces

## File Size Guidelines

- **CV/Resume**: < 5MB
- **Papers**: < 10MB
- **Presentations**: < 20MB
- **Datasets**: Consider external hosting (GitHub, Zenodo, Figshare) for large files

## External Hosting Options

For larger files, use:
- **Google Drive**: Free, unlimited for PDFs and documents
- **GitHub Releases**: For code and data packages
- **Zenodo**: For research datasets (gets DOI)
- **Figshare**: For research outputs
- **arXiv**: For preprints

## Creating Your CV PDF

If you don't have a CV PDF yet:

1. **LaTeX** (recommended for academic CVs)
   - Templates: Overleaf, moderncv, awesome-cv
   - Compile to PDF

2. **Word/Google Docs**
   - Use a professional template
   - Export to PDF

3. **Online CV Builders**
   - Canva, Resume.io, FlowCV
   - Download as PDF

4. **Generate from this website**
   - Open `cv.html` in browser
   - Click "Print CV" button
   - Save as PDF

Make sure to name your CV descriptively:
- Good: `JohnDoe_CV_2024.pdf`
- Bad: `resume.pdf`, `cv.pdf`
