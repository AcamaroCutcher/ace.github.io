# Papers Directory

Place your research papers and publications in this directory.

## File Organization

### Naming Convention
Use descriptive names that include year and topic:
- `2024-hybrid-optimization-methods.pdf`
- `2023-machine-learning-application.pdf`
- `thesis-2024.pdf`

### File Structure
```
papers/
├── 2024-hybrid-optimization.pdf
├── 2023-numerical-methods.pdf
├── thesis-2024.pdf
├── presentation-icml-2024.pdf
└── supplementary-material.pdf
```

## Linking Papers

### From Research Project Pages
```html
<a href="../papers/2024-hybrid-optimization.pdf" target="_blank" class="pub-link">
    <i class="fas fa-file-pdf"></i> PDF
</a>
```

### From CV Page
```html
<a href="papers/2024-hybrid-optimization.pdf" target="_blank" class="pub-link">
    <i class="fas fa-file-pdf"></i> PDF
</a>
```

### From Main Page
```html
<a href="papers/yourpaper.pdf" class="btn-link" target="_blank">
    <i class="fas fa-file-pdf"></i> Paper
</a>
```

## Alternative: Google Drive Integration

Instead of local hosting, you can use Google Drive:

1. **Upload PDF to Google Drive**
2. **Get shareable link**
   - Right-click → Get link
   - Set to "Anyone with the link"
3. **Extract file ID** from URL:
   ```
   https://drive.google.com/file/d/FILE_ID_HERE/view
   ```
4. **Use in your pages**:
   ```html
   <a href="https://drive.google.com/file/d/FILE_ID/view" target="_blank">
       <i class="fas fa-cloud"></i> View on Google Drive
   </a>
   ```

## Embedded Google Drive PDF

To embed a Google Drive PDF:
```html
<iframe
    src="https://drive.google.com/file/d/FILE_ID/preview"
    width="100%"
    height="600px"
    style="border: none;">
</iframe>
```

## Best Practices

1. **File Size**: Keep PDFs under 10MB
   - Compress using Adobe Acrobat, Smallpdf, or similar
   - Reduce image quality if needed

2. **Accessibility**: Ensure PDFs are text-selectable, not just scanned images

3. **Metadata**: Add proper PDF metadata
   - Title
   - Author
   - Keywords
   - Subject

4. **Version Control**: Keep versions organized
   - `paper-v1.pdf`, `paper-v2.pdf` for drafts
   - `paper-final.pdf` for published version

5. **Copyright**: Only upload papers you have rights to share
   - Check publisher policies
   - Use arXiv or personal website versions if allowed

## Paper Placeholder

If you don't have papers yet:
- Create a placeholder PDF with "Coming Soon"
- Or remove the PDF links until papers are available
- Link to arXiv, DOI, or journal page instead

## DOI and External Links

Often better to link to official sources:
```html
<a href="https://doi.org/10.xxxx/xxxxx" target="_blank">
    <i class="fas fa-external-link-alt"></i> DOI
</a>
<a href="https://arxiv.org/abs/xxxx.xxxxx" target="_blank">
    <i class="fas fa-book"></i> arXiv
</a>
```

This ensures readers always get the latest version and proper citation metadata.
