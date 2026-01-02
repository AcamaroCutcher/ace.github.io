# Setup Guide - Customize Your Portfolio

Follow these steps to customize your personal portfolio website.

## Step 1: Update Personal Information

### Main Page (`index.html`)

1. **Hero Section** (Lines ~40-80)
   ```html
   <!-- Change these -->
   <span class="name">Acamaro Cutcher</span>
   <p class="hero-subtitle">Researcher | Developer | Innovator</p>
   <p class="hero-description">
       Your personal description here...
   </p>
   ```

2. **Social Links** (Lines ~70-85)
   ```html
   <a href="https://github.com/YOUR_USERNAME" target="_blank">
   <a href="https://linkedin.com/in/YOUR_USERNAME" target="_blank">
   <a href="mailto:YOUR_EMAIL@example.com">
   <a href="https://scholar.google.com/citations?user=YOUR_ID">
   ```

3. **About Section** (Lines ~120-150)
   - Update your bio text
   - Modify skills and technologies
   - Add/remove skill categories

4. **Research Projects** (Lines ~180-250)
   - Replace with your actual research projects
   - Update titles, descriptions, and links
   - Add links to papers or GitHub repos

5. **Blog Posts** (Lines ~280-350)
   - Update with your blog post previews
   - Change images, titles, and descriptions
   - Link to actual blog post files

6. **Gallery** (Lines ~400-450)
   - Update image paths
   - Add descriptions for photos
   - Organize by categories

7. **Contact Section** (Lines ~480-530)
   - Update email and location
   - Configure contact form (see README for services)

### CV Page (`cv.html`)

1. **Contact Information** (Sidebar, Lines ~400-450)
   ```html
   <a href="mailto:your.email@example.com">your.email@example.com</a>
   <span>+1 (555) 123-4567</span>
   <span>City, State, Country</span>
   ```

2. **Education** (Lines ~120-180)
   - Add your degrees
   - Update institutions, dates, and details
   - Include thesis titles and advisors

3. **Experience** (Lines ~200-280)
   - Add your work experience
   - Include job titles, companies, and dates
   - List responsibilities and achievements

4. **Publications** (Lines ~300-370)
   - Add your publications
   - Include DOI links and PDFs
   - Separate by type (journal, conference, etc.)

5. **Skills** (Sidebar, Lines ~450-520)
   - Update programming languages
   - Adjust skill levels (change width percentages)
   - Add frameworks and tools

6. **Download CV** (Header, Line ~40)
   ```html
   <a href="files/YOUR_NAME_CV.pdf" download>
   ```
   - Create your CV PDF and place in `files/` folder
   - Name it appropriately (e.g., `JohnDoe_CV.pdf`)

## Step 2: Add Your Content

### Profile Photo

1. Add your photo to `images/profile.jpg`
   - Recommended size: 800x800px
   - Square aspect ratio works best
   - JPG format for smaller file size

### Blog Posts

1. **Create new blog post**
   - Copy `blog/mathematical-modeling.html`
   - Rename to your topic (e.g., `blog/my-research-topic.html`)

2. **Update content**
   - Change title and subtitle
   - Write your content
   - Add code blocks (see examples)
   - Include LaTeX equations if needed

3. **Add to main page**
   - Edit `index.html`
   - Add new blog card in the blog section
   - Link to your new blog post

### Research Projects

1. **Create project page**
   - Copy `research/project1.html`
   - Rename to your project (e.g., `research/machine-learning.html`)

2. **Update project details**
   - Change title, abstract, and methodology
   - Add your results and findings
   - Include team members and funding info

3. **Add PDFs**
   - Place paper PDFs in `papers/` folder
   - Update links in the project page
   - Or link to Google Drive (see README)

4. **Add to main page**
   - Edit `index.html`
   - Add new research card in the research section

### Gallery Photos

1. **Add photos**
   - Place images in `images/gallery/`
   - Name them descriptively (e.g., `conference-icml-2024.jpg`)
   - Recommended size: 1200x900px

2. **Update gallery**
   - Edit `index.html`
   - Add gallery items with correct paths
   - Set categories (conferences, travel, personal)

## Step 3: Customize Colors & Style

### Theme Colors (`css/main.css`, Lines 10-25)

```css
:root {
    /* Change these to your preferred colors */
    --primary-color: #2563eb;      /* Blue */
    --secondary-color: #7c3aed;    /* Purple */
    --accent-color: #06b6d4;       /* Cyan */
}
```

**Color Palette Suggestions:**
- Professional Blue: `#2563eb`
- Academic Green: `#059669`
- Tech Purple: `#7c3aed`
- Research Orange: `#ea580c`

### Fonts (`index.html`, Line 12)

Current: Inter (sans-serif) + JetBrains Mono (code)

To change:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap">
```

Then update `css/main.css`:
```css
--font-sans: 'Your Font', sans-serif;
```

## Step 4: Prepare for Deployment

### Required Files Checklist

- [ ] `images/profile.jpg` - Your profile photo
- [ ] `files/YourName_CV.pdf` - Your CV in PDF format
- [ ] Social links updated (GitHub, LinkedIn, Email)
- [ ] Personal information updated
- [ ] At least one blog post written
- [ ] At least one research project added
- [ ] Gallery photos added (optional)

### Optional Enhancements

- [ ] Add Google Analytics tracking code
- [ ] Set up contact form service (Formspree, EmailJS)
- [ ] Add custom domain (in GitHub Pages settings)
- [ ] Create favicon (`favicon.ico`)
- [ ] Add meta tags for SEO

## Step 5: Test Locally

Before deploying, test your site:

```bash
# Start local server
python -m http.server 8000

# Visit http://localhost:8000
```

**Check:**
- [ ] All links work correctly
- [ ] Images load properly
- [ ] Navigation works on mobile
- [ ] Theme toggle works
- [ ] Contact form is configured
- [ ] No console errors (F12 in browser)

## Step 6: Deploy to GitHub Pages

1. **Commit your changes**
   ```bash
   git add .
   git commit -m "Customize portfolio with my information"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings
   - Navigate to "Pages" in sidebar
   - Under "Source", select "main" branch
   - Select "/" (root) as folder
   - Click "Save"

3. **Wait for deployment**
   - GitHub Actions will build your site
   - Check "Actions" tab for progress
   - Site will be live at `https://yourusername.github.io`

4. **Custom domain (optional)**
   - Add `CNAME` file with your domain
   - Configure DNS settings with your domain provider
   - Update in GitHub Pages settings

## Common Customizations

### Remove Sections You Don't Need

To remove a section from the main page, delete or comment out the HTML:

```html
<!-- Comment out entire section -->
<!--
<section id="gallery" class="section gallery-section">
    ...
</section>
-->
```

Don't forget to also remove the nav link!

### Add New Sections

Copy an existing section structure and modify:

```html
<section id="my-section" class="section">
    <div class="container">
        <h2 class="section-title">My New Section</h2>
        <!-- Your content here -->
    </div>
</section>
```

### Change Layout

The site uses CSS Grid. To change layouts:
- Edit grid-template-columns in relevant CSS files
- Adjust responsive breakpoints in media queries

## Troubleshooting

**Problem**: Images not showing
- Check file paths are correct and case-sensitive
- Ensure images are in the correct folders

**Problem**: Theme not working
- Check browser console for errors (F12)
- Clear browser cache
- Verify JavaScript is enabled

**Problem**: GitHub Pages not updating
- Wait 2-3 minutes after pushing
- Check Actions tab for errors
- Ensure `.nojekyll` file exists

**Problem**: Mobile view broken
- Test responsive design at different widths
- Check CSS media queries
- Verify viewport meta tag exists

## Need Help?

- Read the main [README.md](README.md)
- Check browser console for errors (F12 → Console)
- Review example blog and research pages
- Open an issue on GitHub

---

**Once you've completed customization, your portfolio is ready to showcase your work! 🎉**
