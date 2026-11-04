/*
 * Earthquake recurrence models: "no memory" (Poisson / exponential) and "memory"
 * (Brownian passage time, BPT = inverse Gaussian; Matthews, Ellsworth & Reasenberg, 2002).
 *
 *   mu    mean recurrence interval (years)
 *   alpha aperiodicity (coefficient of variation): 0 = clockwork, ~1 = very irregular
 *
 * Exposes window.BPT. Plain script so pages also work from disk.
 */
(function () {
  'use strict';

  /** log(erfc(z)) for z >= 0 (Numerical Recipes "erfcc", fractional error < 1.2e-7), kept in log form to avoid overflow. */
  function logErfc(z) {
    var t = 1 / (1 + 0.5 * z);
    var p = -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
    return Math.log(t) + p;
  }
  function phi(x) { return x >= 0 ? 1 - 0.5 * Math.exp(logErfc(x / Math.SQRT2)) : 0.5 * Math.exp(logErfc(-x / Math.SQRT2)); }
  function logPhiNeg(x) { return Math.log(0.5) + logErfc(x / Math.SQRT2); }   // log Φ(−x), x ≥ 0

  var BPT = {
    pdf: function (t, mu, a) {
      if (t <= 0) return 0;
      return Math.sqrt(mu / (2 * Math.PI * a * a * t * t * t)) * Math.exp(-((t - mu) * (t - mu)) / (2 * a * a * mu * t));
    },
    cdf: function (t, mu, a) {
      if (t <= 0) return 0;
      var r = Math.sqrt(t / mu), u1 = (r - 1 / r) / a, u2 = (r + 1 / r) / a;
      return Math.min(1, phi(u1) + Math.exp(2 / (a * a) + logPhiNeg(u2)));
    },
    /** Chance of at least one event in (elapsed, elapsed + window], given none since the last one. */
    conditional: function (elapsed, window, mu, a) {
      var F0 = BPT.cdf(elapsed, mu, a), F1 = BPT.cdf(elapsed + window, mu, a);
      return F0 >= 1 ? 1 : Math.max(0, (F1 - F0) / (1 - F0));
    },
    /** Instantaneous rate (per year) given no event for `t` years. */
    hazard: function (t, mu, a) {
      var S = 1 - BPT.cdf(t, mu, a);
      return S <= 1e-12 ? 1 / (2 * a * a * mu) : BPT.pdf(t, mu, a) / S;
    },
    /** Long-run hazard of a BPT process: 1 / (2 α² μ). */
    asymptoticHazard: function (mu, a) { return 1 / (2 * a * a * mu); },

    poisson: {
      pdf: function (t, mu) { return t < 0 ? 0 : Math.exp(-t / mu) / mu; },
      conditional: function (elapsed, window, mu) { return 1 - Math.exp(-window / mu); },
      hazard: function (t, mu) { return 1 / mu; },
    },

    /**
     * Draw an interval from the inverse Gaussian (Michael, Schucany & Haas 1976) using rng() in [0, 1).
     * λ = μ / α².
     */
    sample: function (mu, a, rng) {
      var lambda = mu / (a * a);
      var u1 = Math.max(1e-12, rng()), u2 = rng();
      var nu = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), y = nu * nu;
      var x = mu + (mu * mu * y) / (2 * lambda) - (mu / (2 * lambda)) * Math.sqrt(4 * mu * lambda * y + mu * mu * y * y);
      return rng() <= mu / (mu + x) ? x : (mu * mu) / x;
    },
    samplePoisson: function (mu, rng) { return -mu * Math.log(1 - rng()); },
  };

  window.BPT = BPT;
})();
