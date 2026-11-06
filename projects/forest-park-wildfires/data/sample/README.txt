SYNTHETIC SAMPLE - NOT WRF-SFIRE OUTPUT.

These files were made by data/wrfsfire_to_kml.py from a synthetic wrfout-style NetCDF
(data/make_synthetic_wrfout.py). The fire arrival times come from this project's Rothermel +
minimum-travel-time model (60 east-wind ignitions in Forest Park, staggered 18 min apart, 8 h each),
and the heat flux from WRF-SFIRE's fuel-burnout formula. They exist to show and test the
conversion pipeline; replace the input with a real wrfout_d0X file from your run.

perimeters.kmz   time-stamped perimeters every 2 h (open in Google Earth, use the time slider)
fire_heat.kmz    ground heat flux overlays every 2 h + colour bar
arrival_time.png 16-bit arrival-time texture; textures.json has the bbox and scale
