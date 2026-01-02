# Personal Portfolio Website

A modern, responsive personal portfolio website for showcasing research, blog posts, CV, and more. Built with vanilla HTML, CSS, and JavaScript for maximum performance and compatibility with GitHub Pages.

## 🌟 Features

### Core Pages
- **Home** - Professional landing page with hero section
- **About** - Personal information and skills showcase
- **CV/Resume** - Interactive CV with downloadable PDF support
- **Research** - Project showcase with PDF integration and Google Drive support
- **Blog** - Technical articles with code highlighting and LaTeX equations
- **Gallery** - Photo gallery (conferences, travel, personal)
- **Contact** - Contact form and social links

### Technical Capabilities
- ✅ **Code Highlighting** - Syntax highlighting for Python, C/C++, Bash, Mathematica, and more
- ✅ **LaTeX Support** - Mathematical equations rendered with KaTeX
- ✅ **2D/3D Visualizations** - Interactive plots using Plotly.js and Three.js
- ✅ **PDF Integration** - Embedded PDF viewer and Google Drive integration
- ✅ **Dark/Light Mode** - Theme toggle with localStorage persistence
- ✅ **Fully Responsive** - Mobile-first design
- ✅ **Fast & Lightweight** - No build process required
- ✅ **GitHub Pages Ready** - Deploy with zero configuration

## 🚀 Quick Start

### Option 1: Direct Deployment to GitHub Pages

1. **Fork or clone this repository**
   ```bash
   git clone https://github.com/yourusername/yourusername.github.io.git
   cd yourusername.github.io
   ```

2. **Customize your content**
   - Edit `index.html` to update personal information, links, and content
   - Modify `cv.html` with your education, experience, and publications
   - Add your profile image to `images/profile.jpg`
   - Update social links and contact information

3. **Deploy to GitHub Pages**
   ```bash
   git add .
   git commit -m "Initial portfolio setup"
   git push origin main
   ```

4. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select "main" branch and "/" (root) as source
   - Your site will be live at `https://yourusername.github.io`

### Option 2: Local Development

Serve the website locally using any static server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## 📁 Project Structure

```
├── index.html              # Main landing page
├── cv.html                 # CV/Resume page
├── css/
│   ├── main.css           # Main styles
│   ├── theme.css          # Dark/light theme
│   ├── cv.css             # CV page styles
│   ├── blog.css           # Blog post styles
│   └── research.css       # Research project styles
├── js/
│   └── main.js            # Main JavaScript (navigation, theme toggle, etc.)
├── blog/
│   └── mathematical-modeling.html  # Sample blog post
├── research/
│   └── project1.html      # Sample research project
├── images/
│   ├── profile.jpg        # Your profile photo
│   ├── blog/              # Blog post images
│   └── gallery/           # Gallery photos
├── papers/                # Research papers (PDF)
└── files/                 # Downloadable files (CV PDF, etc.)
```

## 🎨 Customization Guide

### 1. Personal Information

Edit `index.html` and update:
- Name and title in the hero section
- Bio and description
- Social media links (GitHub, LinkedIn, Google Scholar, Email)
- Skills and technologies

### 2. CV/Resume

Edit `cv.html` to add:
- Education history
- Work experience
- Publications
- Awards and honors
- Skills and certifications

### 3. Research Projects

Create new research project pages in the `research/` folder:
- Copy `research/project1.html` as a template
- Update project details, methodology, results
- Add PDFs to `papers/` folder
- Link Google Drive files if needed

### 4. Blog Posts

Create blog posts in the `blog/` folder:
- Copy `blog/mathematical-modeling.html` as a template
- Write content with Markdown-like structure
- Add code blocks with syntax highlighting
- Include LaTeX equations and visualizations

### 5. Gallery Photos

Add photos to `images/gallery/`:
- Organize by category (conferences, travel, personal)
- Update the gallery section in `index.html`
- Recommended image size: 1200x900px

### 6. Theme Colors

Edit CSS variables in `css/main.css`:
```css
:root {
    --primary-color: #2563eb;    /* Main brand color */
    --secondary-color: #7c3aed;  /* Accent color */
    --accent-color: #06b6d4;     /* Highlight color */
}
```

## 📝 Adding Content

### Adding a Blog Post

1. Create a new HTML file in `blog/` folder
2. Copy the structure from `blog/mathematical-modeling.html`
3. Update the content, title, and metadata
4. Add entry to the blog grid in `index.html`:

```html
<article class="blog-card" data-category="your-category">
    <div class="blog-image">
        <img src="images/blog/your-image.jpg" alt="Post title">
    </div>
    <div class="blog-content">
        <div class="blog-meta">
            <span class="blog-date"><i class="far fa-calendar"></i> Date</span>
            <span class="blog-read-time"><i class="far fa-clock"></i> X min read</span>
        </div>
        <h3>Your Post Title</h3>
        <p>Brief description...</p>
        <div class="blog-tags">
            <span class="tag">Tag1</span>
        </div>
        <a href="blog/your-post.html" class="btn-link">
            Read Article <i class="fas fa-arrow-right"></i>
        </a>
    </div>
</article>
```

### Adding Code Snippets

Use Prism.js syntax highlighting:

```html
<div class="code-block">
    <div class="code-header">
        <span class="code-language">
            <i class="fab fa-python"></i> Python
        </span>
        <button class="copy-code" onclick="copyCode(this)">
            <i class="far fa-copy"></i> Copy
        </button>
    </div>
    <pre><code class="language-python">
def hello_world():
    print("Hello, World!")
    </code></pre>
</div>
```

Supported languages: python, cpp, c, bash, javascript, mathematica, java, r, matlab

### Adding LaTeX Equations

Use KaTeX for mathematical equations:

```html
<!-- Display equation -->
<div class="equation-block">
    <span class="katex-equation">
        \[ E = mc^2 \]
    </span>
</div>

<!-- Inline equation -->
<p>The equation <span class="inline-math">\( F = ma \)</span> is fundamental.</p>
```

### Adding Interactive Visualizations

Use Plotly.js for 2D/3D plots:

```html
<div id="my-plot" class="visualization-container"></div>

<script>
const data = [{
    x: [1, 2, 3, 4],
    y: [10, 15, 13, 17],
    type: 'scatter'
}];

const layout = {
    title: 'My Plot',
    xaxis: {title: 'X Axis'},
    yaxis: {title: 'Y Axis'}
};

Plotly.newPlot('my-plot', data, layout);
</script>
```

### Adding PDFs

#### Local PDF Files:
1. Add PDF to `papers/` folder
2. Link to it: `<a href="papers/yourpaper.pdf" download>Download PDF</a>`

#### Google Drive PDFs:
1. Upload PDF to Google Drive
2. Get shareable link
3. Extract file ID from URL: `https://drive.google.com/file/d/FILE_ID/view`
4. Link to it: `<a href="https://drive.google.com/file/d/FILE_ID/view" target="_blank">View on Google Drive</a>`

## 🎯 Best Practices

1. **Images**: Optimize images before uploading (use tools like TinyPNG)
2. **PDFs**: Keep PDF file sizes reasonable (<10MB)
3. **Code**: Use proper syntax highlighting for readability
4. **SEO**: Update meta descriptions in each HTML file
5. **Accessibility**: Use alt text for images and ARIA labels
6. **Performance**: Minimize use of heavy external libraries

## 🌐 External Libraries Used

- **Font Awesome** - Icons (CDN)
- **Google Fonts** - Inter & JetBrains Mono fonts
- **Prism.js** - Syntax highlighting
- **KaTeX** - LaTeX equation rendering
- **Plotly.js** - Interactive 2D/3D visualizations
- **PDF.js** - PDF viewing (optional)

## 🔧 Advanced Customization

### Adding Three.js 3D Visualizations

Include Three.js in your blog post:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<div id="three-container" style="width: 100%; height: 500px;"></div>

<script>
// Your Three.js code here
</script>
```

### Custom Contact Form Integration

Replace the placeholder form in `index.html` with:

- **Formspree**: https://formspree.io/
- **EmailJS**: https://www.emailjs.com/
- **Netlify Forms** (if deploying to Netlify)
- **Google Forms** embed

### Adding Analytics

Add Google Analytics or Plausible Analytics to track visitors:

```html
<!-- Add before closing </head> tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 📱 Mobile Optimization

The site is fully responsive with breakpoints at:
- Mobile: < 480px
- Tablet: < 768px
- Desktop: < 968px
- Large screens: > 968px

## 🐛 Troubleshooting

### Images not loading
- Check file paths are correct (case-sensitive on Linux/Mac)
- Ensure images are in the `images/` folder
- Verify image file extensions match (`jpg` vs `jpeg`)

### GitHub Pages not updating
- Wait 2-3 minutes after pushing
- Check GitHub Actions tab for build status
- Ensure `.nojekyll` file exists in root

### Theme not persisting
- Check browser localStorage is enabled
- Clear browser cache and cookies

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to fork this repository and customize it for your own use. If you find bugs or have suggestions, please open an issue.

## 📧 Contact

For questions or support, please contact [your.email@example.com](mailto:your.email@example.com)

---

**Built with ❤️ using vanilla HTML, CSS, and JavaScript**

Deploy your own portfolio in minutes! 🚀
