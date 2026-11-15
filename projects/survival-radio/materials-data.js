// Materials list for the Survival Radio page (used by materials.js).
// US prices checked 2026-11-14. verified:false = price could not be confirmed on the live page that day.
export const CHECKED = '2026-11-14';
export const MATERIALS = [
 {
  "cat": "Brains & radios",
  "item": "Controller",
  "part": "Adafruit ESP32-S3 Feather, 4 MB flash / 2 MB PSRAM (PID 5477)",
  "qty": 1,
  "price": 17.5,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/5477",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Brains & radios",
  "item": "Mesh radio",
  "part": "RAKwireless WisBlock Meshtastic Starter Kit (RAK4631 + RAK19007), US915",
  "qty": 1,
  "price": 24.99,
  "vendor": "RAKwireless",
  "url": "https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit",
  "alt": [
   "Rokland (US distributor)",
   "https://store.rokland.com/collections/mesh-page/products/rak-wireless-wisblock-meshtastic-starter-kit"
  ],
  "verified": false,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Brains & radios",
  "item": "LoRa u.FL to SMA bulkhead pigtail",
  "part": "Adafruit SMA to uFL RF adapter cable, panel-mount SMA, RG178, 15 cm (PID 851)",
  "qty": 1,
  "price": 3.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/851",
  "verified": true,
  "note": "Page doesn't say whether an O-ring is included; fit an O-ring/gasket on the outside of the lid.",
  "kind": "hub"
 },
 {
  "cat": "Brains & radios",
  "item": "LoRa antenna",
  "part": "915 MHz whip, SMA male (e.g. TE Linx ANT-916-CW-RCS-SMA)",
  "qty": 1,
  "price": 10,
  "priceHi": 30,
  "vendor": "DigiKey",
  "url": "https://www.digikey.com/en/products/detail/te-connectivity-linx/ANT-916-CW-RCS-SMA/16630288",
  "verified": false,
  "note": "Check SMA vs RP-SMA. Adafruit's 900 MHz kit (3340) is no longer stocked.",
  "kind": "hub"
 },
 {
  "cat": "Satellite",
  "item": "Satellite modem",
  "part": "Ground Control RockBLOCK 9704, SMA variant (SparkFun WRL-29226)",
  "qty": 1,
  "price": 279.95,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/rockblock-9704-sma.html",
  "alt": [
   "Ground Control",
   "https://store.groundcontrol.com/products/rockblock-9704"
  ],
  "verified": true,
  "note": "SparkFun page shows $279.95 but says backorder.",
  "kind": "hub"
 },
 {
  "cat": "Satellite",
  "item": "Iridium antenna",
  "part": "Helical Iridium Certified Passive Antenna (Maxtena M1621HCT-P-SMA)",
  "qty": 1,
  "price": 80,
  "vendor": "Ground Control",
  "url": "https://store.groundcontrol.com/products/helical-iridium-certified-passive-antenna",
  "alt": [
   "SparkFun",
   "https://www.sparkfun.com/iridium-qualified-9704-helical-antenna.html"
  ],
  "verified": false,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Satellite",
  "item": "Iridium coax + sealed bulkhead",
  "part": "1 m LMR240 SMA-M to SMA-M cable with F-F SMA bulkhead",
  "qty": 1,
  "price": 38,
  "vendor": "Ground Control",
  "url": "https://store.groundcontrol.com/products/1m-lmr240-m2m-sma-with-f2f-sma-bulkhead-connector",
  "verified": false,
  "note": "Ground Control kit for running the modem's SMA through the lid.",
  "kind": "hub"
 },
 {
  "cat": "Satellite",
  "item": "Airtime (Iridium Messaging Transport)",
  "part": "RockBLOCK 9704 prepaid: $15/month access + 64 KB data pack $29",
  "qty": 1,
  "price": 15,
  "vendor": "Ground Control",
  "url": "https://groundcontrol.com/products/iridium-messaging-transport-imt-pricing/",
  "verified": true,
  "note": "Price is per month. Data packs: 64 KB $29, 512 KB $210. Post-paid plans run $17-50/month.",
  "kind": "airtime"
 },
 {
  "cat": "Location & motion",
  "item": "GNSS receiver",
  "part": "SparkFun GNSS Receiver Breakout, u-blox MAX-M10S, Qwiic (GPS-18037)",
  "qty": 1,
  "price": 45.95,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Location & motion",
  "item": "GNSS antenna",
  "part": "Adafruit GPS Antenna, External Active, 3-5 V 28 dB, 5 m cable, SMA (PID 960)",
  "qty": 1,
  "price": 21.5,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/960",
  "verified": true,
  "note": "Standard SMA. The 5 m cable must be coiled inside the case.",
  "kind": "hub"
 },
 {
  "cat": "Location & motion",
  "item": "Accelerometer",
  "part": "Adafruit LIS3DH Triple-Axis Accelerometer, STEMMA QT (PID 2809)",
  "qty": 1,
  "price": 4.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/2809",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "CO2 / temp / humidity",
  "part": "Adafruit SCD-41 True CO2 sensor, STEMMA QT (PID 5190)",
  "qty": 1,
  "price": 49.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/5190",
  "alt": [
   "Mouser (485-5190)",
   "https://www.mouser.com/ProductDetail/485-5190"
  ],
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "Particles (smoke/dust)",
  "part": "Adafruit PMSA003I Air Quality Breakout, STEMMA QT (PID 4632)",
  "qty": 1,
  "price": 44.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/4632",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "Carbon monoxide",
  "part": "DFRobot Gravity CO Sensor, factory calibrated, I2C/UART (SEN0466)",
  "qty": 1,
  "price": 66.9,
  "vendor": "DFRobot",
  "url": "https://www.dfrobot.com/product-2508.html",
  "alt": [
   "RobotShop (RB-Dfr-1180)",
   "https://www.robotshop.com/products/gravity-co-sensor-calibrated-i2c-uart"
  ],
  "verified": false,
  "note": "RobotShop's live page shows $85.24 (backorder).",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "Oxygen",
  "part": "DFRobot Gravity I2C Electrochemical O2 Sensor, 0-25 %vol (SEN0322)",
  "qty": 1,
  "price": 68.11,
  "vendor": "RobotShop",
  "url": "https://www.robotshop.com/products/dfrobot-gravity-i2c-oxygen-sensor",
  "alt": [
   "DFRobot direct",
   "https://www.dfrobot.com/search-SEN0322.html"
  ],
  "verified": true,
  "note": "Backordered at RobotShop ($67.16 earlier).",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "Methane (natural gas)",
  "part": "Winsen MH-440D NDIR CH4 sensor, UART (0-5 %vol or 100 %LEL)",
  "qty": 1,
  "price": 117.5,
  "priceHi": 205,
  "vendor": "Winsen (official shop)",
  "url": "https://shop.winsen-sensor.com/products/mh-440d-ndir-infrared-ch4-sensor-c3h8-sensor",
  "alt": [
   "Winsen product page (quote)",
   "https://www.winsen-sensor.com/product/mh-440d.html"
  ],
  "verified": false,
  "note": "No list price on the product page (quote only). The Winsen shop selling a 2-pack for $235 (about $117.50 each); single units on eBay run about $205.",
  "kind": "hub"
 },
 {
  "cat": "Sensors",
  "item": "Temp / humidity / pressure",
  "part": "Adafruit BME280, STEMMA QT (PID 2652)",
  "qty": 1,
  "price": 14.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/2652",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "E-paper display",
  "part": "Waveshare 2.9inch e-Paper Module, 296x128, SPI (SKU 12956)",
  "qty": 1,
  "price": 21.99,
  "vendor": "Waveshare",
  "url": "https://www.waveshare.com/2.9inch-e-Paper-Module.htm",
  "verified": true,
  "note": "Page lists $21.99, with a $20.79 volume tier.",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "SOS switch guard",
  "part": "SparkFun Missile Switch Cover, Red (COM-09278)",
  "qty": 1,
  "price": 2.5,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/missile-switch-cover-red.html",
  "verified": true,
  "note": "Cover only; fits SparkFun's toggle switch COM-09276.",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "SOS toggle switch",
  "part": "SparkFun Toggle Switch, SPST heavy-duty (COM-09276)",
  "qty": 1,
  "price": 2.25,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/products/9276",
  "verified": false,
  "note": "Not IP-rated, so seal the bushing with an O-ring/gasket under the lid. For a true IP67 switch see the NKK WT11S (DigiKey), but that may not fit the cover.",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "Momentary pushbuttons",
  "part": "SparkFun Metal Pushbutton, momentary, 16 mm, LED ring, IP65 (COM-13405, red)",
  "qty": 3,
  "price": 4.95,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/metal-pushbutton-momentary-16mm-red-1.html",
  "alt": [
   "DigiKey: CIT BH16NFSBX (IP67)",
   "https://www.digikey.com/en/products/detail/cit-relay-and-switch/BH16NFSBX/12503678"
  ],
  "verified": true,
  "note": "The LED ring doubles as the status LED. Adafruit's rugged 16 mm buttons (481) are out of stock.",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "Piezo buzzer",
  "part": "Adafruit Piezo Buzzer PS1240 (PID 160)",
  "qty": 1,
  "price": 1.5,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/160",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Controls & display",
  "item": "Vibration motor (sensor pod)",
  "part": "Adafruit Vibrating Mini Motor Disc (PID 1201)",
  "qty": 1,
  "price": 1.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/1201",
  "verified": true,
  "note": "Needs a small transistor driver.",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "Battery pack",
  "part": "GlobTek 21700 1S4P Li-ion pack, 3.6 V 20 Ah (BL5000C21701S4PFTM106IBC1NN)",
  "qty": 1,
  "price": 59.14,
  "vendor": "DigiKey",
  "url": "https://www.digikey.com/en/products/detail/globtek-inc/BL5000C21701S4PFTM106IBC1NN/22531484",
  "alt": [
   "DIY: Molicel P50B 21700 cells x4 (IMR Batteries, ~$9.99 each)",
   "https://imrbatteries.com/products/molicel-21700-p50b-5000mah-60a-battery"
  ],
  "verified": false,
  "note": "Check the datasheet for the protection board and the 10k NTC lead. The DIY route also needs a 1S protection board (e.g. Tenergy P/N 32190, $8.49, includes a 10k NTC) and a holder.",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "Charger / power path",
  "part": "Adafruit Universal USB / DC / Solar Li-ion charger, bq24074 (PID 4755)",
  "qty": 1,
  "price": 14.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/4755",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "5 V boost with enable",
  "part": "Adafruit MiniBoost 5V @ 1A, TPS61023 (PID 4654)",
  "qty": 1,
  "price": 3.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/4654",
  "alt": [
   "Pololu S9V11F5 buck-boost with EN, $6.95",
   "https://www.pololu.com/product/2836"
  ],
  "verified": true,
  "note": "EN low gives a true output disconnect. Pololu U3V40F5 passes VIN through when disabled, so it is not suitable.",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "Inline fuse holder",
  "part": "Littelfuse MINI blade in-line fuse holder, 20 A max, 14 AWG leads (0FHM0001ZXJ) + 3 A mini blade fuse",
  "qty": 1,
  "price": 7.56,
  "vendor": "Waytek Wire",
  "url": "https://www.waytekwire.com/product/littelfuse-0fhm0001zxj-mini-in-line-fuse-holder",
  "verified": false,
  "note": "Fuse not priced.",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "TVS diodes (USB 5 V and DC-IN)",
  "part": "Littelfuse SMAJ5.0A (USB) + SMAJ12A (6-10 V DC-IN), 400 W, DO-214AC",
  "qty": 2,
  "price": 0.3,
  "priceHi": 0.65,
  "vendor": "DigiKey",
  "url": "https://www.digikey.com/en/products/detail/littelfuse-inc/SMAJ5-0A/762462",
  "verified": false,
  "note": "SMD part: solder it on a small breakout or across the connector pins.",
  "kind": "hub"
 },
 {
  "cat": "Power",
  "item": "Solar panel",
  "part": "BigBlue SolarPowa 28, 28 W foldable, USB-A/USB-C 5 V",
  "qty": 1,
  "price": 62.99,
  "priceHi": 69.99,
  "vendor": "BigBlue",
  "url": "https://www.bigblue-tech.com/products/28w-sunpower-solar-charger",
  "verified": false,
  "note": "The 5 V USB output feeds the USB-C bulkhead.",
  "kind": "power-extra"
 },
 {
  "cat": "Power",
  "item": "Hand crank",
  "part": "K-TOR Pocket Socket USB 1AMP (5 V DC, 1 A)",
  "qty": 1,
  "price": 85.0,
  "vendor": "K-TOR",
  "url": "https://www.k-tor.com/shop/generators/pocket-socket-2/",
  "verified": true,
  "note": "Adafruit no longer stocks it.",
  "kind": "power-extra"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "Case",
  "part": "Pelican 1200 Protector Case, no foam, black (1200-001-110)",
  "qty": 1,
  "price": 69.95,
  "vendor": "Innerspace Cases",
  "url": "https://innerspacecases.com/solutions/pelican-cases/small-cases/pelican-1200-no-foam-black/",
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "USB-C bulkhead",
  "part": "Amphenol LTW UC-00PMFY-SC7001 IP67 USB-C panel receptacle with cap",
  "qty": 1,
  "price": 20,
  "priceHi": 40,
  "vendor": "DigiKey",
  "url": "https://www.digikey.com/en/products/detail/amphenol-ltw/UC-00PMFY-SC7001/9561519",
  "verified": false,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "Sensor-pod connector (hub side)",
  "part": "Murrelektronik M12 8-pin female bulkhead to 0.5 m pigtail, IP67, M16 nut (7231-17181-9730050)",
  "qty": 1,
  "price": 22.5,
  "vendor": "AutomationDirect",
  "url": "https://www.automationdirect.com/adc/shopping/catalog/cables_(terminated)/cable_connectors/7231-17181-9730050",
  "verified": true,
  "note": "Needs a 16 mm hole.",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "Sensor-pod cordset (pod side)",
  "part": "M12 8-pole male A-coded, push-pull, to pigtail, 2 m PUR, IP68 (M12A-08BMMM-PL8B02AD)",
  "qty": 1,
  "price": 16.5,
  "vendor": "AutomationDirect",
  "url": "https://www.automationdirect.com/adc/shopping/catalog/cables_(terminated)/circular_connection_cables/m12a-08bmmm-pl8b02ad",
  "verified": true,
  "note": "Push-pull coupling; confirm it locks to the threaded female bulkhead before ordering, or use a field-wireable 8-pin male (7000-17301-0000000).",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "DC-IN connector (hub side)",
  "part": "Murrelektronik M12 4-pin female bulkhead to 0.5 m pigtail, 22 AWG, IP67 (7231-13541-9710050)",
  "qty": 1,
  "price": 12.5,
  "vendor": "AutomationDirect",
  "url": "https://www.automationdirect.com/adc/shopping/catalog/cables_(terminated)/cable_connectors/7231-13541-9710050",
  "verified": true,
  "note": "Uses 4-pin M12 instead of 2-pin (2 pins spare). M16 x 1.5 nut.",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "DC-IN cordset (panel/crank adapter)",
  "part": "Murrelektronik M12 4-pole male A-coded to pigtail, 2 m, 22 AWG (7000-12021-2140200)",
  "qty": 1,
  "price": 7.5,
  "vendor": "AutomationDirect",
  "url": "https://www.automationdirect.com/adc/shopping/catalog/cables_(terminated)/circular_connection_cables/7000-12021-2140200",
  "verified": true,
  "note": "Wire the pigtail to the solar/crank plug.",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "STEMMA QT / Qwiic cables",
  "part": "Adafruit STEMMA QT JST SH 4-pin cable, 50 mm (PID 4399)",
  "qty": 4,
  "price": 0.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/4399",
  "alt": [
   "Adafruit 100 mm (PID 4210, out of stock)",
   "https://www.adafruit.com/product/4210"
  ],
  "verified": true,
  "note": "",
  "kind": "hub"
 },
 {
  "cat": "Enclosure & connectors",
  "item": "M2.5 standoffs and screws",
  "part": "Adafruit black nylon M2.5 screw and standoff set, 380 pcs (PID 3299)",
  "qty": 1,
  "price": 16.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/3299",
  "verified": true,
  "note": "Nylon rather than brass.",
  "kind": "hub"
 },
 {
  "cat": "Carry-along",
  "item": "406 MHz PLB (register with NOAA)",
  "part": "ACR ResQLink 400, USA-programmed (2921)",
  "qty": 1,
  "price": 409.95,
  "priceHi": 459.95,
  "vendor": "ACR Electronics",
  "url": "https://www.acrartex.com/products/resqlink-400",
  "alt": [
   "Ocean Signal rescueME PLB1, USA (730S-01261), Defender ~$399.95",
   "https://www.defender.com/product.jsp?id=4576649"
  ],
  "verified": true,
  "note": "ACR's page shows a $409.95-459.95 range. Dealers list it at $380-410.",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "SDR receiver (receive only)",
  "part": "RTL-SDR Blog V4 (R828D, RTL2832U, 1PPM TCXO, SMA) with dipole antenna kit",
  "qty": 1,
  "price": 54.95,
  "vendor": "RTL-SDR Blog store",
  "url": "https://www.rtl-sdr.com/product/rtl-sdr-blog-v4-r828d-rtl2832u-1ppm-tcxo-sma-software-defined-radio-with-dipole-antenna/",
  "alt": [
   "RTL-SDR Blog store (V4L Lite kit, $47.95)",
   "https://www.rtl-sdr.com/store"
  ],
  "verified": true,
  "note": "Price has risen from $39.95 at launch to $54.95, and the item is out of stock. SparkFun's V4 kit (WRL-27543, $84.95) is retired. The newer V4L kit is $47.95 but not yet stocked on Amazon US.",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "SDR computer",
  "part": "Raspberry Pi Zero 2 W (PiShop SKU 1799)",
  "qty": 1,
  "price": 17.25,
  "priceHi": 19.05,
  "vendor": "PiShop.us",
  "url": "https://www.pishop.us/product/raspberry-pi-zero-2-w/",
  "alt": [
   "Adafruit (PID 5291, $19.05)",
   "https://www.adafruit.com/product/5291"
  ],
  "verified": true,
  "note": "Out of stock at both PiShop ($17.25) and Adafruit ($19.05). Raspberry Pi still advertises it as a $15 computer.",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "microSD card",
  "part": "SanDisk Ultra microSDHC 32 GB Class 10, blank (PiShop SKU 964)",
  "qty": 1,
  "price": 13.95,
  "vendor": "PiShop.us",
  "url": "https://www.pishop.us/product/microsd-card-32-gb-class-10-blank/",
  "alt": [
   "Official Raspberry Pi A2 32 GB (PiShop, $19.95, out of stock)",
   "https://www.pishop.us/product/raspberry-pi-sd-card-32gb/"
  ],
  "verified": true,
  "note": "Adafruit's 16 GB (2693) and 32 GB (6010) cards are no longer stocked.",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "USB OTG adapter",
  "part": "Adafruit USB OTG Host Cable, MicroB OTG male to A female (PID 1099)",
  "qty": 1,
  "price": 2.5,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/1099",
  "verified": true,
  "note": "",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "Ham handheld with APRS (license needed)",
  "part": "Yaesu FT-5DR C4FM/FM 144/430 MHz, GPS + APRS",
  "qty": 1,
  "price": 384.95,
  "priceHi": 484.95,
  "vendor": "GigaParts",
  "url": "https://www.gigaparts.com/yaesu-ft5dr-c4fm-fm-dual-band-transceiver.html",
  "verified": true,
  "note": "$384.95 is after a mail-in rebate; the regular price is $484.95.",
  "kind": "carry"
 },
 {
  "cat": "Carry-along",
  "item": "Ham handheld with APRS (alternative)",
  "part": "Kenwood TH-D75A 144/220/430 MHz, D-STAR + APRS + GPS",
  "qty": 1,
  "price": 699.95,
  "priceHi": 749.95,
  "vendor": "GigaParts",
  "url": "https://www.gigaparts.com/kenwood-th-d75a-144-220-430mhz-tri-band-handheld-transceiver-with-d-star-and-aprs.html",
  "verified": true,
  "note": "$699.95 is after a mail-in rebate; the regular price is $749.95. Buy one radio or the other, not both.",
  "kind": "carry"
 },
 {
  "cat": "Build materials",
  "item": "3D-printer filament (printed parts)",
  "part": "Prusament PETG Jet Black, 1 kg",
  "qty": 1,
  "price": 23.99,
  "priceHi": 29.99,
  "vendor": "Prusa Research",
  "url": "https://www.prusa3d.com/product/prusament-petg-jet-black-1kg/",
  "verified": true,
  "note": "On sale at $23.99 (regular $29.99). Ships in 4-7 business days. ASA is the alternative for parts left in hot sun. One spool covers the plate, cradle, bezel and pod shell.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "26 AWG silicone hookup wire",
  "part": "Adafruit Silicone Cover Stranded-Core Wire, 25 ft, 26 AWG, black (PID 2517) + red (PID 2513)",
  "qty": 2,
  "price": 4.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/2517",
  "alt": [
   "Red (PID 2513)",
   "https://www.adafruit.com/product/2513"
  ],
  "verified": true,
  "note": "",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "22 AWG stranded hookup wire (power runs)",
  "part": "SparkFun Hook-up Stranded Wire, black, 22 AWG, 25 ft (PRT-08867); buy red PRT-08865 too",
  "qty": 2,
  "price": 5.95,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/hook-up-stranded-wire-black-22-awg.html",
  "alt": [
   "Illumn 22 AWG silicone wire, 10 m (~$5.50)",
   "https://www.illumn.com/22-awg-silicone-wire-10-meters-red.html"
  ],
  "verified": false,
  "note": "The SparkFun wire is probably PVC; no 22 AWG silicone wire was found at Adafruit, SparkFun or Pololu.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Heat-shrink assortment",
  "part": "SparkFun Heat Shrink Kit, 95 pcs (PRT-09353)",
  "qty": 1,
  "price": 10.95,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/heat-shrink-kit.html",
  "alt": [
   "Adafruit multi-colored pack (PID 1649, $4.95, out of stock)",
   "https://www.adafruit.com/product/1649"
  ],
  "verified": true,
  "note": "",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Solder",
  "part": "Adafruit Solder Spool, SAC305 lead-free, 0.031 in rosin core, 100 g (PID 734)",
  "qty": 1,
  "price": 29.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/734",
  "alt": [
   "SparkFun lead-free 100 g (TOL-09325, ~$24.95)",
   "https://www.sparkfun.com/solder-lead-free-100-gram-spool.html"
  ],
  "verified": true,
  "note": "",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Conformal coating",
  "part": "MG Chemicals 419D-340G premium acrylic conformal coating, 340 g aerosol",
  "qty": 1,
  "price": 29.95,
  "priceHi": 45.4,
  "vendor": "Vetco Electronics",
  "url": "https://vetco.net/products/mg-419d-340g_mg_acrylic_conformal_coating_spray_-_12oz",
  "alt": [
   "MG Chemicals (manufacturer page)",
   "https://mgchemicals.com/products/conformal-coating/conformal-coating-spray/conformal-spray/"
  ],
  "verified": false,
  "note": "Aerosol ships ground only.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Shock-mount pads for mounting plate",
  "part": "Adafruit Little Rubber Bumper Feet, polyurethane, 8 mm x 4 mm, pack of 4 (PID 550)",
  "qty": 2,
  "price": 0.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/550",
  "verified": true,
  "note": "Cheap stand-in for silicone pads. 3M VHB 4910/5952 rolls cost $46-90 per roll at industrial sellers, so VHB was left off.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Cable glands / strain relief",
  "part": "Adafruit Cable Gland PG-9, 4-6.4 mm cable (PID 761)",
  "qty": 2,
  "price": 1.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/761",
  "verified": true,
  "note": "Use for the sensor-pod cable entry and any solar lead.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Desiccant packs",
  "part": "Silica gel desiccant, 5 g packets, 50-pack (EMS cat. 71206-05)",
  "qty": 1,
  "price": 14.0,
  "vendor": "Electron Microscopy Sciences",
  "url": "https://www.emsdiasum.com/silica-gel-desiccant-5-gr",
  "verified": false,
  "note": "Indicating 5 g x 50 packs sell for about $9-10 at general retailers.",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Zip ties",
  "part": "Panduit PLT1M-C miniature cable tie, 3.9 in, natural nylon, 100-pack",
  "qty": 1,
  "price": 16.59,
  "priceHi": 21.74,
  "vendor": "Zoro",
  "url": "https://www.zoro.com/panduit-39-l-miniature-cable-tie-nat-pk-100-plt1m-c/i/G4624225/",
  "alt": [
   "Elliott Electric ($21.74/100)",
   "https://www.elliottelectric.com/P/Item/PAN/PLT1MC"
  ],
  "verified": false,
  "note": "",
  "kind": "build"
 },
 {
  "cat": "Build materials",
  "item": "Threadlocker",
  "part": "Loctite 243 medium-strength blue threadlocker, 6 ml tube (1330799)",
  "qty": 1,
  "price": 7.99,
  "priceHi": 13.15,
  "vendor": "Crimp Supply",
  "url": "https://crimpsupply.com/adhesives/threadlocker-243-oil-resistant-blue-6-ml-tube.html",
  "verified": false,
  "note": "US listings run about $8-13. Use only on metal-to-metal threads (bulkhead nuts), never on nylon standoffs.",
  "kind": "build"
 },
 {
  "cat": "Tools",
  "item": "Step drill bit",
  "part": "IRWIN Unibit #3 step drill, 1/4 to 3/4 in in 1/16 steps (10233)",
  "qty": 1,
  "price": 25.59,
  "priceHi": 35.3,
  "vendor": "Plumbers Stock",
  "url": "https://www.plumbersstock.com/irwin-10233.html",
  "alt": [
   "Zoro (~$25.59)",
   "https://zoro.com/irwin-unibit-3-step-drill-bit-9-hole-sizes-14-to-34-in-116-in-steps-high-speed-steel-hex-shank-10233/i/G1959176"
  ],
  "verified": false,
  "note": "About $25.59-35.30. Covers the 16 mm button and M12/M16 holes. SMA bulkheads need about 6.5 mm, so step past 1/4 in or use a 17/64 in twist bit.",
  "kind": "tool"
 },
 {
  "cat": "Tools",
  "item": "Deburring tool",
  "part": "NOGA Rapid Burr RB1000 with S10 blade",
  "qty": 1,
  "price": 12.95,
  "vendor": "Penn Tool Co.",
  "url": "https://www.penntoolco.com/noga-rapid-burr-rb1000-82-356-7",
  "verified": true,
  "note": "",
  "kind": "tool"
 },
 {
  "cat": "Tools",
  "item": "Soldering iron",
  "part": "PINE64 Pinecil V2 smart mini soldering iron",
  "qty": 1,
  "price": 25.99,
  "priceHi": 35.99,
  "vendor": "PINE64",
  "url": "https://pine64.com/product/pinecil-smart-mini-portable-soldering-iron/",
  "verified": true,
  "note": "Needs a USB-C PD (20 V) supply.",
  "kind": "tool"
 },
 {
  "cat": "Tools",
  "item": "Multimeter",
  "part": "SparkFun Digital Multimeter, Basic (TOL-12966)",
  "qty": 1,
  "price": 21.5,
  "vendor": "SparkFun",
  "url": "https://www.sparkfun.com/digital-multimeter-basic.html",
  "verified": true,
  "note": "Not auto-ranging. Good enough for the sleep-current and continuity checks.",
  "kind": "tool"
 },
 {
  "cat": "Tools",
  "item": "Crimp tool (JST / Dupont)",
  "part": "Engineer PA-09 universal micro crimping pliers, 1.0-1.9 mm contacts (Adafruit PID 350)",
  "qty": 1,
  "price": 49.95,
  "vendor": "Adafruit",
  "url": "https://www.adafruit.com/product/350",
  "alt": [
   "SparkFun Crimping Pliers 28-20 AWG (TOL-13193, $44.50)",
   "https://www.sparkfun.com/products/13193"
  ],
  "verified": true,
  "note": "",
  "kind": "tool"
 }
];
