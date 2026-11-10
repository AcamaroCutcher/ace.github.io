/*
 * Projects & Papers catalog: the ONLY file to edit when adding work to acamaro.com/projects/.
 * See ADDING_A_PROJECT.md for a copy-paste template.
 *
 * Paths in `href` and `thumb` are relative to the projects/ folder:
 *   "cascadia/index.html"        a tool hosted in projects/cascadia/
 *   "../papers/my-paper.pdf"     a PDF in the site's papers/ folder
 *   "https://..."                anything external (opens in a new tab)
 */
window.PROJECT_LIBRARY = {
  // Sections on the page, in this order. Add a field here before using its id below.
  disciplines: [
    { id: 'earth', name: 'Earth & Environmental Science', icon: 'fa-earth-americas',
      blurb: 'Geology, seismology, climate and wildfire: hazards and forecasts for a changing planet.' },
    { id: 'physics', name: 'Physics', icon: 'fa-atom',
      blurb: 'Plasmonics, electromagnetism and solid-state physics, from theory to the lab.' },
    { id: 'math', name: 'Mathematics', icon: 'fa-square-root-variable',
      blurb: 'Pure and applied mathematics: algebra, probability and modeling.' },
    { id: 'ml', name: 'Machine Learning & Computing', icon: 'fa-microchip',
      blurb: 'Neural operators, data-driven forecasting and scientific computing.' },
  ],

  // Kinds of work, used by the "Type" filter and the badges on each card.
  types: [
    { id: 'interactive', name: 'Interactive', icon: 'fa-hand-pointer' },
    { id: 'paper', name: 'Paper', icon: 'fa-file-lines' },
    { id: 'research', name: 'Research', icon: 'fa-flask' },
    { id: 'code', name: 'Code', icon: 'fa-code' },
    { id: 'video', name: 'Video', icon: 'fa-circle-play' },
  ],

  // Newest first. The first discipline listed is the section the card appears in;
  // any others make it show up when filtering by that field too.
  projects: [
    {
      id: 'fortran-firetec',
      title: 'Fortran for FIRETEC',
      summary: 'A hands-on course in the Fortran behind Los Alamos’ HIGRAD/FIRETEC wildfire model, whose source is now open on GitHub: compilers and kinds, loops and memory order, arrays and halo cells, matrix algebra (Gaussian elimination, tridiagonal solvers, LAPACK), functions, subroutines and modules, a small 1-D fire model, parallel computing with OpenMP and MPI domain decomposition, and a guided tour of the real FIRETEC source. Nine lessons with downloadable programs and exercises.',
      disciplines: ['ml', 'earth'],
      types: ['code', 'interactive'],
      status: 'current',
      year: 2026,
      featured: false,
      tags: ['Fortran', 'MPI', 'OpenMP', 'HPC', 'Numerical methods', 'FIRETEC', 'Wildfire'],
      links: [
        { label: 'Start the course', href: 'fortran-firetec/index.html', icon: 'fa-arrow-right', primary: true },
        { label: 'The math of FIRETEC', href: 'forest-park-wildfires/firetec-math/index.html', icon: 'fa-square-root-variable' },
        { label: 'FIRETEC on GitHub', href: 'https://github.com/lanl/FIRETEC', icon: 'fa-github', brand: true },
      ],
    },
    {
      id: 'forest-park-wildfires',
      title: 'Forest Park Wildfires',
      summary: 'How could a fire in Portland’s Forest Park spread into the neighborhoods around it? A group project (with Andrea Baeza and Alex Bentley) on wildfire risk, community concerns and the CEI Hub. Part I: our partner proposal, a 30 m wildland–urban fuel map, WRF-SFIRE terrain, 26 years of fire weather and 4,000 simulated fires. Part II: a WRF-SFIRE handbook with the model’s math and interactive level-set labs, HPC installation, single, perimeter and multiple ignitions, the WRFx web viewer, converting output to KML/KMZ and 3-D animation, a live 3-D fire simulator of Forest Park, and the math of Los Alamos’ physics-based FIRETEC model.',
      disciplines: ['earth'],
      types: ['research'],
      status: 'current',
      year: 2026,
      featured: false,
      thumb: 'thumbs/forest-park-wildfires.jpg',
      tags: ['Wildfire', 'Wildland–Urban Interface', 'LANDFIRE', 'WRF-SFIRE', 'Level-set method', 'HPC', 'Python / GIS'],
      links: [
        { label: 'Explore', href: 'forest-park-wildfires/index.html', icon: 'fa-arrow-right', primary: true },
        { label: 'Proposal', href: 'forest-park-wildfires/proposal/index.html', icon: 'fa-file-lines' },
        { label: 'Fuel maps', href: 'forest-park-wildfires/fuel-maps/index.html', icon: 'fa-map' },
        { label: 'Terrain', href: 'forest-park-wildfires/terrain/index.html', icon: 'fa-mountain' },
        { label: 'Fire weather', href: 'forest-park-wildfires/fire-weather/index.html', icon: 'fa-wind' },
        { label: 'Fire spread', href: 'forest-park-wildfires/fire-spread/index.html', icon: 'fa-fire' },
        { label: 'WRF-SFIRE handbook', href: 'forest-park-wildfires/wrf-sfire-math/index.html', icon: 'fa-square-root-variable' },
        { label: '3-D simulator', href: 'forest-park-wildfires/fire-3d/index.html', icon: 'fa-mountain-sun' },
        { label: 'Install on HPC', href: 'forest-park-wildfires/install/index.html', icon: 'fa-server' },
        { label: 'KML & 3-D', href: 'forest-park-wildfires/kml-3d/index.html', icon: 'fa-cube' },
      ],
    },
    {
      id: 'cascadia',
      title: 'Cascadia Earthquake Probabilities: Interactive Visualizations',
      summary: 'Ten interactive explainers for USGS Fact Sheet 2025–3050. Reproduce the 50-year odds of deep, shallow and ' +
        'M9 megathrust earthquakes, roll thousands of Monte Carlo futures on a Pacific Northwest map, test the ' +
        'Gutenberg–Richter rule against 45 years of USGS data, rotate a 3D model of the subducting Juan de Fuca plate, ' +
        'and trace 10,000 years of great Cascadia earthquakes. Includes a companion video.',
      disciplines: ['earth', 'math'],
      types: ['interactive', 'video'],
      status: 'completed',
      year: 2026,
      featured: true,
      thumb: 'thumbs/cascadia.jpg',
      tags: ['Seismology', 'Probability', 'Monte Carlo', 'D3 / Canvas', 'JavaScript'],
      links: [
        { label: 'Explore', href: 'cascadia/index.html', icon: 'fa-arrow-right', primary: true },
        { label: 'The story', href: 'cascadia/08-story/index.html', icon: 'fa-book-open' },
        { label: 'Video', href: 'https://www.youtube.com/watch?v=mfdwMcyq9Q4', icon: 'fa-youtube', brand: true },
        { label: 'USGS report', href: 'https://doi.org/10.3133/fs20253050', icon: 'fa-file-pdf' },
      ],
    },
    {
      id: 'tin-melting-md',
      title: 'Melting of Tin from Molecular Dynamics with a Hybrid Machine-Learned Potential',
      summary: 'Summer 2026 at Los Alamos National Laboratory: molecular dynamics simulations of tin in LAMMPS with a ' +
        'hybrid machine-learned interatomic potential, using first-passage-time dynamics to understand how tin melts.',
      disciplines: ['physics', 'ml'],
      types: ['research'],
      year: 2026,
      tags: ['LAMMPS', 'Molecular Dynamics', 'Machine-Learned Potentials', 'First-Passage Times', 'Los Alamos National Laboratory'],
      links: [],
    },
    {
      id: 'wildfire-fno',
      title: 'Modified Fourier Neural Operators for Direct Wildfire Spread Prediction: A FourCastNet Adaptation',
      summary: 'Re-engineers FourCastNet, originally a global weather emulator, into a direct solver for wildfire ' +
        'propagation. Static and dynamic fire drivers (fuel moisture, LANDFIRE vegetation density, high-resolution ' +
        'topography) are added to the input channels, and the AFNO is retrained on historical fire perimeters. ' +
        'FourCastNet runs global weather ensembles about 80,000× faster than numerical models (Kurth et al., 2022); ' +
        'the goal is to bring that speed to fire-spread ensembles, which coupled physics models like WRF-SFIRE compute slowly.',
      disciplines: ['ml', 'earth'],
      types: ['research', 'code'],
      status: 'current',
      tags: ['Python', 'Deep Learning', 'Neural Operators', 'Wildfire'],
      links: [
        { label: 'PSU wildfire capstone code', href: 'https://github.com/PSU-CS-Wildfire-Capstone-Sp-S-25', icon: 'fa-github', brand: true, primary: true },
        { label: 'FourCastNet paper', href: 'https://arxiv.org/abs/2208.05419', icon: 'fa-file-lines' },
      ],
    },
    {
      id: 'monsoon-enoc',
      title: 'Hybrid Data-Driven and Dynamical Forecasting of the South Asian Monsoon Intraseasonal Oscillation',
      summary: 'Works with Ensemble Oscillation Correction (EnOC; Bach et al., 2021, 2024), which uses the near-regularity ' +
        'of monsoon intraseasonal oscillations to correct physics-based ensemble forecasts with data-driven modes, ' +
        'improving rainfall prediction three to four weeks ahead for agricultural and hydrological planning.',
      disciplines: ['earth', 'ml'],
      types: ['research', 'code'],
      status: 'current',
      tags: ['Python / Julia', 'Data-driven Forecasting', 'Climate', 'Dynamical Models'],
      links: [
        { label: 'Code (EnOC.jl fork)', href: 'https://github.com/AcamaroCutcher/ensemble_oscillation_correction.jl', icon: 'fa-github', brand: true, primary: true },
        { label: 'Method paper', href: 'https://doi.org/10.1175/JCLI-D-20-0624.1', icon: 'fa-file-lines' },
        { label: 'Monsoon paper (PNAS)', href: 'https://doi.org/10.1073/pnas.2312573121', icon: 'fa-file-lines' },
      ],
    },
    {
      id: 'minimal-group-embeddings',
      title: 'Minimal Group Embeddings',
      summary: 'Classifies small finite groups and finds their minimal embedding degree: the smallest n with G ↪ Sₙ. ' +
        'Sylow theory is used to analyze prime-power subgroups and verify structure, improving on the bound from ' +
        'Cayley’s theorem, often by a wide margin.',
      disciplines: ['math'],
      types: ['paper'],
      status: 'completed',
      year: 2024,
      tags: ['Abstract Algebra', 'Group Theory', 'Sylow Theorems', 'Honors Thesis'],
      links: [
        { label: 'Paper (PDF)', href: '../papers/401_Honors_Project_Minimal_Group_Embeddings.pdf', icon: 'fa-file-pdf', primary: true },
        { label: 'Google Drive', href: 'https://drive.google.com/file/d/11QWF4rAGJPW7M9WVvOir8p_0_IKP1gID/view?usp=sharing', icon: 'fa-google-drive', brand: true },
      ],
    },
    {
      id: 'spp-theory',
      title: 'Multiscale Theoretical Modeling of Surface Plasmon Polaritons: From Fundamentals to Integrated Photonics',
      summary: 'Derives SPP dispersion relations by applying Bloch’s theorem to Maxwell’s equations, treating the ' +
        'multilayer as a 1D plasmonic crystal. Periodic modulation creates band structures and forbidden gaps, giving ' +
        'a roadmap for tailoring metal–insulator–metal superlattice devices.',
      disciplines: ['physics'],
      types: ['research', 'code'],
      status: 'completed',
      tags: ["Maxwell's Equations", 'Bloch Theorem', 'Solid State Physics', 'Mathematica'],
      links: [
        { label: 'Code', href: 'https://github.com/AcamaroCutcher/Surface-Plasmon-Polariton-Computational-Research-WWU', icon: 'fa-github', brand: true, primary: true },
        { label: 'Google Scholar', href: 'https://scholar.google.com/citations?view_op=view_citation&hl=en&user=OsKdb4IAAAAJ&citation_for_view=OsKdb4IAAAAJ:u5HHmVD_uO8C', icon: 'fa-graduation-cap' },
      ],
    },
    {
      id: 'spp-forbidden-modes',
      title: 'Excitation of “Forbidden” Guided-Wave Plasmon Polariton Modes via Direct Reflectance Using a Low Refractive Index Polymer Coupling Layer',
      summary: 'Angle-resolved reflectance spectroscopy of metal–insulator–metal thin films with a low-index polymer ' +
        'coupling layer excites guided-wave plasmon polariton modes that are normally inaccessible, and shows how the ' +
        'polymer layer changes the coupling conditions.',
      disciplines: ['physics'],
      types: ['paper'],
      status: 'completed',
      year: 2022,
      tags: ['Thin Film Devices', 'AFM / XRR', 'Spectroscopy', 'PLOS ONE'],
      links: [
        { label: 'Paper (PLOS ONE)', href: 'https://doi.org/10.1371/journal.pone.0276522', icon: 'fa-file-lines', primary: true },
        { label: 'Google Scholar', href: 'https://scholar.google.com/citations?view_op=view_citation&hl=en&user=OsKdb4IAAAAJ&citation_for_view=OsKdb4IAAAAJ:u5HHmVD_uO8C', icon: 'fa-graduation-cap' },
      ],
    },
  ],
};
