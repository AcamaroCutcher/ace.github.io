"""Plot fire1d.csv written by fire1d.f90:  python3 plot_fire1d.py"""
import csv
import matplotlib.pyplot as plt

rows = list(csv.DictReader(open("fire1d.csv")))
times = sorted({float(r["time"]) for r in rows})
fig, (a1, a2) = plt.subplots(2, 1, sharex=True, figsize=(8, 6))
for k, t in enumerate(times):
    sel = [r for r in rows if float(r["time"]) == t]
    x = [float(r["x"]) for r in sel]
    c = plt.cm.inferno(0.15 + 0.7 * k / max(1, len(times) - 1))
    a1.plot(x, [float(r["T"]) for r in sel], color=c)
    a2.plot(x, [float(r["fuel"]) for r in sel], color=c, label=f"{t:.0f} s" if k % 3 == 0 else None)
a1.set_ylabel("gas temperature (K)")
a2.set_ylabel("fuel (kg/m³)")
a2.set_xlabel("distance along the strip (m)")
a2.legend(ncol=4, fontsize=8)
fig.tight_layout()
fig.savefig("fire1d.png", dpi=150)
print("wrote fire1d.png")
