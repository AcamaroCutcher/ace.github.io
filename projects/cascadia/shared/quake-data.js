/*
 * Shared data for all visualizations.
 * Every number comes from USGS Fact Sheet 2025–3050 (report.pdf in the project root).
 * Plain script (not an ES module) so pages also work when opened straight from disk.
 */
window.QUAKE = {
  source: {
    title: 'Earthquake Probabilities and Hazards in the U.S. Pacific Northwest',
    citation: 'Wirth, E., and others, 2025, U.S. Geological Survey Fact Sheet 2025–3050, ver. 1.1',
    doi: 'https://doi.org/10.3133/fs20253050',
  },

  // Earthquake types. `color` is a CSS custom property defined in shared/theme.css.
  types: {
    deep:       { label: 'Deep (intraslab)',             color: 'var(--deep)' },
    megathrust: { label: 'Megathrust (subduction zone)', color: 'var(--megathrust)' },
    crustal:    { label: 'Crustal (shallow fault)',      color: 'var(--crustal)' },
  },

  // The seven 50-year probabilities reported in the paper.
  // tau = mean recurrence interval in years; reported = paper's 50-year probability.
  scenarios: [
    {
      id: 'deep-puget', type: 'deep', model: 'time-independent',
      name: 'Deep quake, Puget Sound',
      sentence: 'deep (intraslab) M ≥ 6.5 earthquake beneath the Puget Sound region',
      magnitude: 'M ≥ 6.5', tau: 26, tauLabel: '~26 yr', reported: 0.85, page: 3,
      basis: 'Average of the 16- and 36-year gaps between the 1949 Olympia, 1965 Seattle and 2001 Nisqually earthquakes.',
    },
    {
      id: 'crustal-puget', type: 'crustal', model: 'time-independent',
      name: 'Crustal quake, Puget Sound (all faults)',
      sentence: 'M ≥ 6.5 crustal fault earthquake anywhere in the Puget Sound region',
      magnitude: 'M ≥ 6.5', tau: 265, tauLabel: '~265 yr', reported: 0.17, page: 5,
      basis: 'Paleoseismic record of all Puget Sound crustal faults combined. Small-quake (Gutenberg–Richter) rates give a similar ~280 years.',
    },
    {
      id: 'mega-full', type: 'megathrust', model: 'time-independent',
      name: 'Cascadia M9, full-margin rupture',
      sentence: 'M ~9 earthquake on the Cascadia Subduction Zone',
      magnitude: 'M ~9', tau: 500, tauLabel: '~500 yr', reported: 0.10, page: 4,
      basis: 'NSHM recurrence from coastal subsidence, tsunami deposits and offshore/lake turbidites from California to Vancouver Island.',
    },
    {
      id: 'mega-full-td', type: 'megathrust', model: 'time-dependent',
      name: 'Cascadia M9, full-margin rupture',
      sentence: 'M ~9 earthquake on the Cascadia Subduction Zone',
      magnitude: 'M ~9', tau: 500, tauLabel: '~500 yr', reported: 0.15, page: 4,
      basis: 'Brownian passage-time model that accounts for the last great Cascadia earthquake on January 26, 1700.',
    },
    {
      id: 'mega-south-td', type: 'megathrust', model: 'time-dependent',
      name: 'Southern Cascadia M8+, full or partial',
      sentence: 'M 8+ earthquake in southern Cascadia',
      magnitude: 'M 8+', tau: 330, tauLabel: '~300–350 yr', reported: 0.30, page: 4,
      basis: 'Full-margin ruptures (~500 yr) plus partial-margin ruptures (~800–1,000 yr), with a time-dependent model.',
    },
    {
      id: 'crustal-portland', type: 'crustal', model: 'time-independent',
      name: 'Crustal quake, Portland / N. Willamette Valley',
      sentence: 'M ≥ 6.5 crustal earthquake in the Portland or northern Willamette Valley region',
      magnitude: 'M ≥ 6.5', tau: 800, tauLabel: '~800 yr', reported: 0.06, page: 5,
      basis: 'Crustal fault earthquake rates from the 2023 National Seismic Hazard Model.',
    },
    {
      id: 'crustal-seattle', type: 'crustal', model: 'time-independent',
      name: 'Seattle Fault Zone',
      sentence: 'M ≥ 6.5 earthquake on the Seattle Fault Zone',
      magnitude: 'M ≥ 6.5', tau: 1000, tauLabel: '~1,000 yr', reported: 0.05, page: 5,
      basis: 'Earthquake rates for the Seattle Fault Zone from the 2023 National Seismic Hazard Model.',
    },
  ],

  /** Time-independent (Poisson) probability of at least one event in t years. */
  poisson(tau, t) {
    return 1 - Math.exp(-t / tau);
  },
};
