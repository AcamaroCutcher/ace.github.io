// ======================
// Theme Toggle
// ======================

const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const themeIcon = themeToggle.querySelector('i');

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        localStorage.setItem('theme', 'light');
    }
});

// ======================
// Mobile Navigation
// ======================

const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navMenu = document.getElementById('navMenu');

mobileMenuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    mobileMenuToggle.classList.toggle('active');
});

// Close mobile menu when clicking on a link
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        mobileMenuToggle.classList.remove('active');
    });
});

// ======================
// Navbar Scroll Effect
// ======================

const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// ======================
// Active Navigation Link
// ======================

// Update active nav link on scroll
const sections = document.querySelectorAll('section[id]');

function updateActiveLink() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

        if (navLink && scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLinks.forEach(link => link.classList.remove('active'));
            navLink.classList.add('active');
        }
    });
}

window.addEventListener('scroll', updateActiveLink);

// ======================
// Smooth Scroll
// ======================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));

        if (target) {
            const offsetTop = target.offsetTop - 70;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ======================
// Blog Filters
// ======================

const filterButtons = document.querySelectorAll('.filter-btn');
const blogCards = document.querySelectorAll('.blog-card');

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const filterValue = button.getAttribute('data-filter');

        // Filter blog cards
        blogCards.forEach(card => {
            const categories = card.getAttribute('data-category');

            if (filterValue === 'all' || categories.includes(filterValue)) {
                card.style.display = 'block';
                card.style.animation = 'fadeIn 0.5s';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// ======================
// Gallery Tabs
// ======================

const galleryTabs = document.querySelectorAll('.gallery-tab');
const galleryItems = document.querySelectorAll('.gallery-item');

galleryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Update active tab
        galleryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const galleryFilter = tab.getAttribute('data-gallery');

        // Filter gallery items
        galleryItems.forEach(item => {
            const category = item.getAttribute('data-category');

            if (galleryFilter === 'all' || category === galleryFilter) {
                item.style.display = 'block';
                item.style.animation = 'fadeIn 0.5s';
            } else {
                item.style.display = 'none';
            }
        });
    });
});

// ======================
// Contact Form
// ======================

const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Get form data
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);

        // Here you can add your form submission logic
        // For now, we'll just show an alert
        console.log('Form submitted:', data);
        alert('Thank you for your message! I will get back to you soon.');

        // Reset form
        contactForm.reset();

        // You can integrate with services like:
        // - Formspree (https://formspree.io/)
        // - EmailJS (https://www.emailjs.com/)
        // - Netlify Forms
        // - Your own backend API
    });
}

// ======================
// Scroll Animations
// ======================

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.research-card, .blog-card, .skill-category');

    animateElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(el);
    });
});

// ======================
// Gallery Lightbox
// ======================

const galleryImages = document.querySelectorAll('.gallery-item');

galleryImages.forEach(item => {
    item.addEventListener('click', () => {
        const img = item.querySelector('img');
        const overlay = item.querySelector('.gallery-overlay');

        if (img && img.src) {
            // Create lightbox
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <span class="lightbox-close">&times;</span>
                    <img src="${img.src}" alt="${img.alt}">
                    <div class="lightbox-caption">
                        ${overlay ? overlay.innerHTML : ''}
                    </div>
                </div>
            `;

            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';

            // Close lightbox
            const closeBtn = lightbox.querySelector('.lightbox-close');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(lightbox);
                document.body.style.overflow = 'auto';
            });

            // Close on background click
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) {
                    document.body.removeChild(lightbox);
                    document.body.style.overflow = 'auto';
                }
            });
        }
    });
});

// ======================
// Utility Functions
// ======================

// Add lightbox styles dynamically
const lightboxStyles = document.createElement('style');
lightboxStyles.textContent = `
    .lightbox {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        animation: fadeIn 0.3s;
    }

    .lightbox-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        animation: fadeInUp 0.4s;
    }

    .lightbox-content img {
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 0.5rem;
    }

    .lightbox-close {
        position: absolute;
        top: -2rem;
        right: 0;
        font-size: 2rem;
        color: white;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .lightbox-close:hover {
        transform: scale(1.2);
    }

    .lightbox-caption {
        color: white;
        text-align: center;
        margin-top: 1rem;
    }
`;
document.head.appendChild(lightboxStyles);

// ======================
// Loading Animation
// ======================

window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// ======================
// External Link Handler
// ======================

// Add target="_blank" to external links
document.querySelectorAll('a[href^="http"]').forEach(link => {
    if (!link.href.includes(window.location.hostname)) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    }
});
