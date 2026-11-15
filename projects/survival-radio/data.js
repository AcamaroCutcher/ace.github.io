// Content for the Survival Radio page.
// Shared by the 3D viewer (app.js) and the written guide (guide.js).
// Prices are approximate US retail checked in November 2026; they change often.

export const CAT = {
  brain: { label: 'Brains & radios', color: '#74d2c3' },
  sat: { label: 'Satellite', color: '#b9a5ee' },
  loc: { label: 'Location & motion', color: '#8ab8d8' },
  sense: { label: 'Sensors', color: '#e8776b' },
  power: { label: 'Power', color: '#a4cf6a' },
  ui: { label: 'Controls & display', color: '#f2b33d' },
  rugged: { label: 'Enclosure & connectors', color: '#ff6b1a' },
  ext: { label: 'Carry-along gear', color: '#d98cb3' },
};

export const TIER_NAMES = { 0: 'Tier 0 · carry', 1: 'Tier 1 · DIY hub', 2: 'Tier 2 · ham radio', 3: 'Tier 3 · Starlink' };

// ---------------------------------------------------------------------------------------------
// Components. Keys match the node names in models/survival-radio-hub.glb (from cad/build_cad.py)
// or the procedural accessories built in app.js.
// ---------------------------------------------------------------------------------------------
export const COMP_INFO = {
  feather: {
    name: 'Controller: Adafruit ESP32-S3 Feather', short: 'Controller (ESP32-S3)', cat: 'brain', tier: 1,
    part: 'Adafruit ESP32-S3 Feather, 4 MB flash / 2 MB PSRAM (product 5477)', price: '$17.50',
    buy: [['Adafruit (product 5477)', 'https://www.adafruit.com/product/5477'], ['Pinout guide', 'https://learn.adafruit.com/adafruit-esp32-s3-feather/pinouts']],
    what: 'The brain that runs <b>your</b> program: it watches the SOS switch, reads the GPS and air sensors, builds the SOS message, drives the satellite modem, updates the e-paper screen, and hosts a small web page your phone can open over Wi-Fi. It has Wi-Fi and Bluetooth LE built in, and sleeps at about 100 µA between jobs.',
    why: 'Feather boards are easy to wire, well documented, and run Arduino, ESP-IDF or CircuitPython. This one has a STEMMA QT / Qwiic port, so most sensors plug in without soldering, plus a built-in MAX17048 battery gauge.',
    connects: '<b>UART ×3</b>: RockBLOCK, mesh radio, methane sensor. The ESP32-S3 has three hardware UARTs and can route them to almost any pin; with USB used for the console, all three are free.<br><b>I²C</b>: SDA = GPIO3, SCL = GPIO4, shared with the STEMMA QT port; GPIO7 switches that port\'s power off in sleep.<br><b>SPI</b>: SCK = GPIO36, MOSI = GPIO35 to the e-paper.<br><b>GPIO</b>: SOS switch, buttons, buzzer, 5 V boost enable, RockBLOCK I_EN / I_BTD.<br><b>Power</b>: the system rail into its battery (BAT) input.',
    power: '~100 µA in deep sleep (radios off); tens of mA awake; Wi-Fi bursts to a few hundred mA.',
    specs: [['Chip', 'ESP32-S3, dual-core 240 MHz, Wi-Fi + Bluetooth LE'], ['Size', '52.3 × 22.7 × 7.2 mm'], ['Memory', '4 MB flash, 2 MB PSRAM'], ['Extras', 'MAX17048 fuel gauge, NeoPixel, STEMMA QT']],
    guide: '#g-brain',
  },
  rak: {
    name: 'Mesh radio: RAK4631 on RAK19007 (Meshtastic)', short: 'Mesh radio (LoRa)', cat: 'brain', tier: 1,
    part: 'RAKwireless WisBlock Meshtastic Starter Kit (RAK4631 nRF52840 + SX1262 core on RAK19007 base)', price: '$24.99 kit (before shipping)',
    buy: [['RAKwireless store', 'https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit'], ['Rokland (US distributor)', 'https://store.rokland.com/collections/mesh-page/products/rak-wireless-wisblock-meshtastic-starter-kit'], ['RAK19007 datasheet', 'https://docs.rakwireless.com/product-categories/wisblock/rak19007/datasheet/']],
    what: 'A ready-made Meshtastic node. It sends short text messages and GPS positions to other Meshtastic radios over 915 MHz LoRa, hopping through other nodes. Your phone talks to it with the official Meshtastic app over Bluetooth LE. It comes pre-flashed, so you don\'t write firmware for it.',
    why: 'Keeping the mesh radio on stock firmware means the phone app, updates and community support all just work. Your own code runs on the controller and talks to the radio through a documented serial API.',
    connects: '<b>UART to the controller</b>: RAK19007 TXD1 (pin 16) → controller RX, RXD1 (pin 15) ← controller TX, GND ↔ GND. In Meshtastic set the <i>Serial module</i> to mode <code>PROTO</code>, RX 15 / TX 16. Baud defaults to 38400; 115200 is a common choice. Set <i>GPS mode</i> to <code>Not_Present</code>, because this UART is shared with the RAK\'s GPS slot.<br><b>RF</b>: u.FL → coax pigtail → SMA bulkhead → LoRa antenna.<br><b>BLE</b>: a small PCB antenna for the phone link.',
    power: 'Roughly 5–6 mA listening and 100–120 mA while transmitting at +22 dBm. The nRF52840 is very frugal in sleep.',
    specs: [['Radio', 'Semtech SX1262 LoRa, 902–928 MHz (US, no license)'], ['MCU', 'Nordic nRF52840 with Bluetooth LE'], ['Base board', 'RAK19007: 30 × 60 × 8.5 mm, 1 core + 1 IO + 4 sensor slots'], ['Packets', 'Up to 239 bytes; 3 hops by default, 7 max']],
    guide: '#g-brain',
  },
  rockblock: {
    name: 'Satellite modem: RockBLOCK 9704 (SMA)', short: 'Satellite modem', cat: 'sat', tier: 1,
    part: 'Ground Control RockBLOCK 9704, SMA variant (Iridium Certus 9704, IMT)', price: '$279 + airtime',
    buy: [['Ground Control store', 'https://store.groundcontrol.com/products/rockblock-9704'], ['SparkFun', 'https://www.sparkfun.com/rockblock-9704-sma.html'], ['Hardware docs & pinout', 'https://docs.groundcontrol.com/iot/rockblock-9704/hardware'], ['C / Arduino / Python library', 'https://github.com/rock7/RockBLOCK-9704'], ['Airtime pricing', 'https://groundcontrol.com/products/iridium-messaging-transport-imt-pricing/']],
    what: 'Your phone-independent path to the outside world. It sends your SOS message to an Iridium satellite. Iridium covers the whole planet, so it works anywhere you can see the sky. The message lands in Ground Control\'s Cloudloop service, which forwards it to email, a webhook, MQTT and other destinations.',
    why: 'It is a certified, network-approved transmitter, so wiring it to your controller is legal (you are not building a satellite transmitter yourself). It takes messages from 25 bytes up to 100 KB, typically reaching the cloud in about 10 seconds.',
    connects: 'One 16-pin, 0.1-inch header (3.3 V logic):<br>• pin 13 <b>TXD</b> → controller RX; pin 14 <b>RXD</b> ← controller TX (UART, fixed at <b>230400 baud</b>)<br>• pin 15 <b>V_IN+</b> 4.0–5.3 V (500 mA) from the 5 V boost; pins 1/4/10/16 ground<br>• pin 3 <b>I_EN</b> ← controller GPIO (turn on/off); pin 7 <b>I_BTD</b> → controller GPIO (says "booted")<br>• SMA → helical antenna on the lid.<br>Protocol: Iridium\'s JSON-based <b>JSPR</b>, wrapped by Ground Control\'s open-source library (<code>rbBegin()</code>, <code>rbSendMessage()</code>, <code>rbReceiveMessage()</code>).',
    power: '60 mW idle, 1.4 W peak while transmitting. Onboard supercapacitors charge first; startup takes about 40 s from a DC supply. The controller powers it down between messages.',
    specs: [['Size', '48 × 52 × 16 mm, 35 g (SMA variant)'], ['Messages', '25 bytes to 100 KB (Iridium Messaging Transport)'], ['Airtime', '$15/month access + prepaid data, e.g. 64 KB for $29 (~$0.45/KB), 25-byte minimum per session'], ['Temperature', '−40 to +70 °C']],
    guide: '#g-sat',
  },
  iridiumAnt: {
    name: 'Iridium antenna: passive helical (Maxtena M1621HCT-P-SMA)', short: 'Iridium antenna', cat: 'sat', tier: 1,
    part: 'Helical Iridium Certified Passive Antenna (Maxtena M1621HCT-P-SMA)', price: '$80',
    buy: [['Ground Control', 'https://store.groundcontrol.com/products/helical-iridium-certified-passive-antenna'], ['SparkFun', 'https://www.sparkfun.com/iridium-qualified-9704-helical-antenna.html'], ['1 m SMA cable + bulkhead kit ($38)', 'https://store.groundcontrol.com/products/1m-lmr240-m2m-sma-with-f2f-sma-bulkhead-connector']],
    what: 'Talks to Iridium satellites in the 1616–1626.5 MHz band. It must see open sky: under a roof, rubble or heavy tree cover, satellite links get weak or stop. That is why the mesh radio and PLB layers exist.',
    why: 'The RockBLOCK 9704 SMA is designed for an approved passive antenna, and its SMA connector gives no DC power to an active one.',
    connects: 'RockBLOCK SMA → short low-loss coax → SMA female bulkhead (with O-ring) in the lid → antenna screws on top.',
    power: 'Passive, so it draws no power.',
    specs: [['Rating', 'IP67, −40 to +85 °C'], ['Connector', 'SMA male'], ['Shape in CAD', 'Approximate envelope']],
    guide: '#g-sat',
  },
  loraAnt: {
    name: 'LoRa antenna: 915 MHz whip on an SMA bulkhead', short: 'LoRa antenna', cat: 'brain', tier: 1,
    part: 'u.FL → SMA-female bulkhead pigtail + 915 MHz whip (the kit\'s 2 dBi rubber antenna, or a 3–5 dBi whip)', price: '$10–30',
    buy: [['RAK store (antennas)', 'https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit']],
    what: 'Carries the mesh radio\'s signal. Height matters far more than gain. In backpack mode a mast lifts it above your head, and a node on a hilltop or roof reaches much farther.',
    why: 'A flexible whip survives drops. The bulkhead lets you swap in a bigger antenna or a coax run to a mast.',
    connects: 'RAK4631 LoRa u.FL → thin coax → SMA bulkhead in the lid → whip. <b>Never power the radio without an antenna attached</b>, or transmitting can damage it.',
    power: 'Passive.', specs: [['Band', '902–928 MHz'], ['Connector', 'SMA (check RP-SMA vs SMA when buying)']],
    guide: '#g-brain',
  },
  gnss: {
    name: 'GNSS receiver: SparkFun MAX-M10S (Qwiic)', short: 'GNSS receiver', cat: 'loc', tier: 1,
    part: 'SparkFun GNSS Receiver Breakout, u-blox MAX-M10S (GPS-18037)', price: '$45.95',
    buy: [['SparkFun', 'https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html']],
    what: 'Works out where you are from GPS, Galileo, GLONASS and BeiDou together. It is receive-only. The controller keeps the last good position in memory, so an SOS sent from indoors or under debris still carries your last known location and how old it is.',
    why: 'It draws under 25 mW while tracking and talks over I²C, so it saves the controller\'s UARTs for the modems.',
    connects: '<b>I²C</b> (Qwiic cable: black GND, red 3.3 V, blue SDA, yellow SCL), address <b>0x42</b>. <b>RF</b>: its SMA → short cable → active patch antenna stuck to the inside of the lid.',
    power: '< 25 mW tracking; much less in power-save mode.',
    specs: [['Accuracy', '~1.5 m horizontal (open sky)'], ['Update rate', 'Up to 10 Hz'], ['Protocols', 'UBX binary or NMEA, over I²C or UART']],
    guide: '#g-loc',
  },
  gnssPatch: {
    name: 'GNSS patch antenna (inside the lid)', short: 'GNSS antenna', cat: 'loc', tier: 1,
    part: 'Active multi-GNSS (L1) ceramic patch antenna with SMA cable', price: '$10–25', buy: [],
    what: 'Picks up the very weak navigation signals. The case lid is plastic, which these signals pass through, so the antenna can stay inside with no extra hole.',
    why: 'One less hole to seal. A larger ground plane under the patch helps.',
    connects: 'RF coax to the GNSS receiver\'s SMA connector. The receiver powers the antenna\'s small amplifier through the coax.',
    power: 'A few mA for the built-in amplifier.', specs: [['Placement', 'Under the lid, away from metal and the Iridium antenna']],
    guide: '#g-loc',
  },
  imu: {
    name: 'Motion sensor: Adafruit LIS3DH accelerometer', short: 'Motion sensor', cat: 'loc', tier: 1,
    part: 'Adafruit LIS3DH Triple-Axis Accelerometer, STEMMA QT (product 2809)', price: '$4.95',
    buy: [['Adafruit (product 2809)', 'https://www.adafruit.com/products/2809']],
    what: 'Feels motion. It logs aftershocks, notices a fall (free-fall detection), and tells the controller if you have stopped moving, which can start an automatic SOS countdown.',
    why: 'The chip itself draws about 2 µA and can raise an interrupt, so it watches for motion while everything else sleeps.',
    connects: '<b>I²C</b> address <b>0x18</b> (or 0x19). Its <b>INT1</b> pin goes to a controller GPIO so motion can wake the ESP32.',
    power: 'Microamps.', specs: [['Range', '±2 / 4 / 8 / 16 g'], ['Features', 'Tap, double-tap, orientation, free-fall']],
    guide: '#g-loc',
  },
  sensorPod: {
    name: 'Sensor pod (3D-printed): gas, oxygen, CO₂ and smoke', short: 'Sensor pod', cat: 'sense', tier: 1,
    part: 'Printed two-part shell (downloads) with DFRobot O₂ + CO, NDIR methane, Sensirion SCD-41, PMSA003I, BME280', price: '≈ $260–330 for all sensors',
    buy: [['DFRobot CO, calibrated (SEN0466)', 'https://www.dfrobot.com/product-2508.html'], ['DFRobot O₂ (SEN0322)', 'https://www.robotshop.com/products/dfrobot-gravity-i2c-oxygen-sensor'], ['Winsen MH-440D methane', 'https://www.winsen-sensor.com/product/mh-440d.html'], ['Adafruit SCD-41 (Mouser)', 'https://www.mouser.com/ProductDetail/485-5190'], ['Adafruit PMSA003I', 'https://www.adafruit.com/product/4632']],
    what: 'Samples the air you breathe. In case mode it clips to the side of the case; in backpack mode it rides on the shoulder strap near your face. It warns about natural gas from broken lines, carbon monoxide from generators run indoors, low oxygen and high CO₂ in a confined space, and smoke or dust. Its latest readings ride along in every SOS message. Try the <b>Sensors</b> tab.',
    why: 'Each gas needs a different sensing principle: electrochemical cells for CO and O₂, infrared (NDIR) for methane and CO₂, and a laser particle counter for smoke. It is an awareness tool, not a certified gas detector.',
    connects: 'One sealed <b>M12 8-pin</b> cable to the hub: 5 V, 3.3 V, GND, SDA, SCL, UART TX/RX (methane sensor) and an alert line for the LED and vibration motor. Inside the pod everything except the methane sensor sits on the I²C bus: SCD-41 <b>0x62</b>, BME280 <b>0x77</b>, PMSA003I <b>0x12</b>, O₂ <b>0x70–0x73</b>, CO (set by a dial switch). Keep the cable under about 1 m and run I²C at 100 kHz, or use a differential I²C extender for longer runs.',
    power: 'About 2 Wh/day when duty-cycled (estimate). The methane sensor (< 60–85 mA) and particle counter (≤ 100 mA) are switched off between readings.',
    specs: [['Size', '86 × 46 × 124 mm (printable shell)'], ['CO', 'DFRobot SEN0466: 0–1000 ppm, factory calibrated, < 5 mA'], ['O₂', 'DFRobot SEN0322 / SEN0465: 0–25 %vol, ~2-year cell life'], ['Methane', 'NDIR (Winsen MH-440D class), 3-min warm-up'], ['CO₂', 'SCD-41: 400–5000 ppm, ±(40 ppm + 5 %)'], ['Particles', 'PMSA003I: PM1 / 2.5 / 10, once per second']],
    guide: '#g-sense',
  },
  podConn: {
    name: 'Sensor-pod connector: M12 8-pin bulkhead', short: 'Pod connector', cat: 'rugged', tier: 1,
    part: 'M12 A-coded 8-pin female panel connector + matching cordset', price: '$15–40', buy: [],
    what: 'A sealed, screw-locking connector for the sensor pod cable, so the pod can move from the case to your shoulder strap.',
    why: 'Screw-coupled M12 connectors stay sealed and do not pull out when snagged.',
    connects: 'Pins: 1 = 5 V, 2 = GND, 3 = 3.3 V, 4 = SDA, 5 = SCL, 6 = hub TX → methane RX, 7 = methane TX → hub RX, 8 = alert (LED / vibration).',
    power: '—', specs: [['Rating', 'IP67 when mated or capped']], guide: '#g-rugged',
  },
  battery: {
    name: 'Battery: 4 × 21700 Li-ion in parallel (1S4P) with BMS', short: 'Battery 72 Wh', cat: 'power', tier: 1,
    part: '4 × 21700 cells of about 5,000 mAh (e.g. Samsung 50S, Molicel P50B), bought as a pre-built 1S4P pack with protection board and 10k NTC', price: '$40–90',
    buy: [],
    what: 'Stores about 72 Wh (4 × 5 Ah × 3.6 V). The hub itself needs only a few Wh per day, so this pack runs it for weeks. Recharging a phone is the big load, at about 20 Wh per charge.',
    why: 'Li-ion 21700 cells hold the most energy for their weight. Cells inside a rigid cradle survive drops far better than soft pouch cells, which can swell or be punctured.',
    connects: 'Pack + / − → inline fuse → the charger\'s BAT terminals. The 10k NTC thermistor goes to the charger\'s thermistor input, so charging stops below 0 °C (charging cold plates lithium and ruins cells) or when too hot.',
    power: 'Source: 3.0–4.2 V.', specs: [['Capacity', '≈ 20 Ah at 3.6 V ≈ 72 Wh'], ['Rule', 'Never charge below 0 °C'], ['Fallback', 'Keep sealed lithium AA cells for an emergency SOS-only supply']],
    guide: '#g-power',
  },
  power: {
    name: 'Charger and power path: Adafruit bq24074 + 5 V boost', short: 'Charger / power', cat: 'power', tier: 1,
    part: 'Adafruit Universal USB / DC / Solar Li-ion charger (bq24074, product 4755) + 5 V boost + fuse + TVS diodes', price: '$14.95 + ~$10',
    buy: [['Adafruit (product 4755)', 'https://www.adafruit.com/products/4755'], ['Upgrade: TI BQ25798 (MPPT, 5 A)', 'https://www.ti.com/product/BQ25798']],
    what: 'Takes power from USB-C (5 V), a 6–10 V solar panel or a hand crank, and charges the battery while also running the hub (this is called "power path" or load sharing). A 5 V boost converter makes the 5 V rail for the satellite modem and particle sensor; the controller can switch it off.',
    why: 'The bq24074 is a simple, proven board. It backs off its current when the input sags below about 4.5 V, which roughly tracks a solar panel\'s best operating point ("near-MPPT"). The upgrade path is TI\'s BQ25798: 3.6–24 V input, 5 A, true MPPT and I²C control. It also takes car 12 V and 18 V panels directly.',
    connects: 'Inputs: the USB-C and DC-IN bulkheads (through TVS diodes). Battery: the 1S4P pack plus NTC. Output: the LOAD rail (never above 4.4 V) → controller BAT input, mesh radio battery input, and the 5 V boost (EN pin ← controller GPIO).',
    power: 'Charges at up to 1.5 A (1 A default). <b>Phone charging</b>: the bq24074 only takes power in. To charge a phone from the hub battery, use the BQ25798: its USB OTG mode runs the converter backwards and puts 5 V (up to 3.32 A) on the USB-C port, so the same sealed port charges the hub or your phone. A small USB-C port controller handles the CC pins that tell the phone it may draw power.', specs: [['Inputs', '5–10 V DC / USB-C, 6–10 V solar'], ['Protection', 'Inline fuse at the pack; TVS diodes on inputs'], ['Thermistor', '10k NTC input for temperature cut-off']],
    guide: '#g-power',
  },
  ports: {
    name: 'Sealed power ports: IP67 USB-C + M12 DC-IN', short: 'Power ports', cat: 'rugged', tier: 1,
    part: 'IP67 USB-C bulkhead with captive cap (e.g. Amphenol LTW UC-00PMFY-SC7001) + 2-pin M12 panel connector', price: '$30–60',
    buy: [['Amphenol LTW UC-00PMFY-SC7001 (DigiKey)', 'https://www.digikey.com/en/products/detail/amphenol-ltw/UC-00PMFY-SC7001/9561519']],
    what: 'Lets power in without letting water in. USB-C charges from power banks, wall chargers and USB solar panels. DC-IN takes a 6–10 V solar panel or the hand crank.',
    why: 'Each hole in the case is a leak risk, so use connectors rated IP67 even when nothing is plugged in, or keep their caps on.',
    connects: 'USB-C 5 V → charger USB input. DC-IN → TVS + fuse → charger DC input.',
    power: '—', specs: [['Rating', 'IP67 (USB-C bulkhead with threaded coupling)']], guide: '#g-rugged',
  },
  display: {
    name: 'E-paper status display: Waveshare 2.9" module', short: 'E-paper display', cat: 'ui', tier: 1,
    part: 'Waveshare 2.9inch e-Paper Module, 296 × 128, SPI', price: '≈ $20–28',
    buy: [['Waveshare', 'https://www.waveshare.com/2.9inch-e-Paper-Module.htm']],
    what: 'Shows battery, last GPS fix, satellite and mesh status, and alarms. E-paper keeps its image with <b>zero</b> power and is readable in sunlight, so you can glance at it any time without draining the battery.',
    why: 'An LCD would need constant power and a backlight.',
    connects: '<b>SPI</b> (write-only): SCK → CLK, MOSI → DIN, CS, DC (data or command), RST (reset) and BUSY (the panel says "wait"), plus 3.3 V and GND on the 8-pin cable.',
    power: '≈ 26 mW only while refreshing; < 0.017 mW standby.', specs: [['Outline', '89.5 × 38 mm'], ['Active area', '66.89 × 29.05 mm'], ['Refresh', 'Partial refresh supported']],
    guide: '#g-ui',
  },
  panel: {
    name: 'Control panel: printed bezel, window, buttons, LED', short: 'Control panel', cat: 'ui', tier: 1,
    part: '3D-printed bezel (downloads) + clear polycarbonate window + 3 IP67 momentary pushbuttons + LED', price: '$15–40',
    buy: [],
    what: 'The parts you touch. The three buttons (Menu, Send, Cancel) let you use the hub with no phone. The LED blinks to show status even when the screen is off.',
    why: 'Printed in PETG or ASA and screwed through the lid over a gasket, it seals the display window and holds the buttons.',
    connects: 'Each button: one leg to a controller GPIO set to pull-up, the other to GND. LED: GPIO → resistor → LED.',
    power: '—', specs: [['Print', 'PETG or ASA, 4 mm, with a gasket underneath']], guide: '#g-ui',
  },
  sos: {
    name: 'Guarded SOS switch', short: 'SOS switch', cat: 'ui', tier: 1,
    part: 'IP-rated toggle switch with a flip-up safety cover', price: '$10–25', buy: [],
    what: 'One deliberate action starts the whole SOS routine without a phone. The cover stops a bump in your bag from sending a false alarm. Try it in the <b>SOS</b> tab.',
    why: 'A false satellite alert wastes rescuers\' time. A physical guard is the oldest and most reliable fix.',
    connects: '<b>GPIO</b>: one terminal to a controller pin set to input with pull-up, the other to GND. Flipping it pulls the pin LOW, and that edge wakes the ESP32 from deep sleep.',
    power: 'None.', specs: [['Sequence', 'Wake → fix → read sensors → satellite (retries) → mesh → repeat']], guide: '#g-ui',
  },
  alerts: {
    name: 'Buzzer (vibration motor is in the pod)', short: 'Buzzer', cat: 'ui', tier: 1,
    part: 'Piezo buzzer (+ coin vibration motor in the pod)', price: '$2–5', buy: [],
    what: 'Beeps for alarms, button feedback and "message sent" confirmations, and helps searchers find you by sound.',
    why: 'Sound carries through debris where light does not.',
    connects: '<b>GPIO</b> with PWM (a square wave sets the tone). The vibration motor needs a small transistor driver.',
    power: 'A few mA while beeping.', specs: [], guide: '#g-ui',
  },
  plate: {
    name: 'Printed mounting plate', short: 'Mounting plate', cat: 'rugged', tier: 1,
    part: '3D-printed plate (downloads), PETG, M2.5 brass standoffs', price: '$5 of filament',
    buy: [],
    what: 'A flat, non-conductive floor for all the boards, so nothing shorts on anything else and the whole electronics tray lifts out in one piece.',
    why: 'Boards sit on standoffs. Mounting the plate on silicone pads soaks up drop shocks.',
    connects: '—', power: '—', specs: [['Size', '228 × 173 × 3 mm, fits the Pelican 1200 floor']], guide: '#g-rugged',
  },
  case: {
    name: 'Rugged case: Pelican 1200 Protector', short: 'IP67 case', cat: 'rugged', tier: 1,
    part: 'Pelican 1200 (no-foam version 1200-001-110) or a similar Nanuk case', price: '≈ $70–85',
    buy: [['Innerspace Cases (1200, no foam)', 'https://innerspacecases.com/solutions/pelican-cases/small-cases/pelican-1200-no-foam-black/']],
    what: 'The armored shell. It is rated IP67: dust-tight and able to survive 1 m of water for 30 minutes. An automatic purge valve lets air pressure equalize with altitude and temperature without letting water in.',
    why: 'Hard cases like this have proven O-ring seals, latches and hinges, so you only have to seal the holes you drill.',
    connects: 'Nothing electrical. Seal every connector hole with its O-ring and leak-test the case after drilling.',
    power: '—', specs: [['Interior', '236.5 × 181 × 104.6 mm (9.31 × 7.13 × 4.12 in)'], ['Exterior', '271 × 248 × 123 mm'], ['Depth', 'Lid 30 mm + base 74 mm'], ['Ratings', 'IP67, Def Stan 81-41'], ['Temperature', '−40 to 99 °C']],
    guide: '#g-rugged',
  },
  lid: {
    name: 'Lid: control panel, antennas and GNSS', short: 'Lid', cat: 'rugged', tier: 1,
    part: 'Pelican 1200 lid, drilled for the panel, the SOS switch and two SMA bulkheads', price: 'incl. with case', buy: [],
    what: 'Everything you look at or touch is on the lid: display window, buttons, SOS switch and the two antennas. The GNSS antenna sits inside, under the plastic.',
    why: 'Antennas on top point at the sky when the case lies flat.',
    connects: 'Cables from the base to the lid need slack across the hinge (ribbon for the display, coax for the antennas).',
    power: '—', specs: [['Holes', '1 window, 3 buttons, 1 LED, 1 switch, 2 SMA, 4 screws']], guide: '#g-rugged',
  },
  // ---------------- Accessories (procedural) ----------------
  phone: {
    name: 'Your phone', short: 'Phone', cat: 'ext', tier: 0,
    part: 'Any smartphone. iPhone 14+ and Pixel 9/10 also have their own satellite SOS.', price: 'already owned', buy: [],
    what: 'Your keyboard and screen. It connects to the mesh radio with the <b>Meshtastic app over Bluetooth</b>, and to the hub\'s own web page over <b>Wi-Fi</b> (no app needed). Phones break and run flat, so the hub works fully without one.',
    why: 'Typing on a phone is far easier than three buttons.',
    connects: 'Bluetooth LE to the mesh radio; Wi-Fi to the controller (http://192.168.4.1); optional USB-C cable.',
    power: 'About 20 Wh per full recharge, the biggest load on the battery.', specs: [], guide: '#g-phone',
  },
  plb: {
    name: '406 MHz Personal Locator Beacon (buy and register)', short: 'PLB', cat: 'sat', tier: 0,
    part: 'ACR ResQLink or Ocean Signal rescueME', price: '$300–450, no subscription', buy: [],
    what: 'The one part you must <b>buy, not build</b>. It sends a distress alert and your GPS position through the international COSPAS-SARSAT system straight to search and rescue. It needs no subscription, but you must register it with NOAA (free).',
    why: 'Federal rules require PLBs to be type-approved, certified and registered, so homemade beacons are illegal.',
    connects: 'Nothing. It is a separate, independent backstop.', power: 'Own battery, designed for 24+ hours of transmission.', specs: [['System', 'COSPAS-SARSAT 406 MHz + 121.5 MHz homing']], guide: '#g-carry',
  },
  ht: {
    name: 'Ham radio handheld with APRS (licensed)', short: 'Ham radio (APRS)', cat: 'ext', tier: 2,
    part: 'Yaesu FT-5DR or Kenwood TH-D75 (built-in GPS + APRS)', price: '$400–650', buy: [],
    what: 'Regional backbone after a disaster. APRS on 144.390 MHz broadcasts your position to digipeaters and internet gateways (visible on aprs.fi). Winlink sends email with no internet. Portland\'s emergency volunteers use these bands.',
    why: 'Needs an amateur <b>Technician</b> license (HF needs General). Homebrew transmitters are allowed for licensees.',
    connects: 'Optional: a USB sound-card interface (e.g. Digirig) to a computer or Pi for Winlink.', power: 'Own battery.', specs: [['Rule', 'No encryption on amateur bands']], guide: '#g-carry',
  },
  sdr: {
    name: 'SDR receiver: RTL-SDR Blog V4 + Raspberry Pi Zero 2 W (receive only)', short: 'SDR receiver', cat: 'ext', tier: 2,
    part: 'RTL-SDR Blog V4 dongle with dipole antenna set + Raspberry Pi Zero 2 W + microSD card + USB OTG adapter', price: '$60–90',
    buy: [['RTL-SDR Blog V4 (maker\'s announcement and pricing)', 'https://www.rtl-sdr.com/rtl-sdr-blog-v4-dongle-initial-release/'], ['SparkFun (V4 + dipole kit)', 'https://www.sparkfun.com/rtl-sdr-blog-v4-usb-dongle-with-dipole-antenna-kit.html'], ['Raspberry Pi Zero 2 W', 'https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/']],
    what: 'A software-defined radio: the dongle turns a slice of the radio spectrum into numbers, and software on the Pi does the rest. After a disaster it is a powerful <b>listener</b>: NOAA Weather Radio (162.400–162.550 MHz), aircraft ADS-B at 1090 MHz so you can see rescue helicopters working your area, unencrypted public-safety and ham traffic, and a survey of which cellular bands are still on the air.',
    why: 'This is where SDR genuinely helps. It cannot replace a cell tower or a satellite phone: those bands are licensed, and the networks only accept certified, provisioned devices. The RTL-SDR only receives, so it needs no license.',
    connects: '<b>USB</b>: dongle → USB OTG adapter → Pi Zero 2 W. <b>Phone</b>: the Pi runs its own Wi-Fi hotspot and a web interface, such as OpenWebRX for listening or readsb + tar1090 for an aircraft map, so you use it from the phone\'s browser. <b>Power</b>: 5 V USB from a power bank, or from the hub\'s USB-C port with the BQ25798 charger upgrade. <b>Antenna</b>: SMA; the kit\'s telescoping dipole covers VHF and UHF.',
    power: 'About 1.5–2 W together while receiving, so 2 hours uses about 3–4 Wh.',
    specs: [['Tuning range', '500 kHz – 1.766 GHz, up to 3.2 MHz wide (2.4 MHz stable)'], ['Tuner', 'R828D with built-in HF upconverter and triplexer filtering'], ['Pi Zero 2 W', '4 × 1 GHz Cortex-A53, 512 MB, Wi-Fi + Bluetooth, $15'], ['Transmit?', 'No. Transmit-capable SDRs (HackRF, ADALM-Pluto) belong on amateur bands, with a license and filtering']],
    guide: '#g-why',
  },
  solar: {
    name: 'Folding solar panel (20–40 W)', short: 'Solar panel', cat: 'power', tier: 1,
    part: '20–40 W foldable ETFE panel with USB-C / USB-A and DC outputs', price: '$60–150', buy: [],
    what: 'Recharges the hub in daylight. In a Portland summer expect very roughly 3–4 Wh per panel-watt per day; on overcast winter days, well under 1. With the simple bq24074 charger, use the panel\'s 5 V USB output or a 6–10 V panel; 18 V panels need the BQ25798 upgrade. Shown at real size.',
    why: 'Sunlight is the one fuel you can count on for weeks.',
    connects: 'USB-C cable → hub USB-C port, or 6–10 V DC → M12 DC-IN.', power: 'Source.', specs: [], guide: '#g-power',
  },
  crank: {
    name: 'Hand-crank USB generator', short: 'Hand crank', cat: 'power', tier: 1,
    part: 'Pocket hand-crank generator with USB output (about 5–10 W)', price: '$40–100', buy: [],
    what: 'A last-resort trickle. Ten minutes at about 8 W gives about 1.3 Wh: enough for several satellite messages, but not a phone charge.',
    why: 'It works at night, in a basement, in the rain.',
    connects: 'USB cable → hub USB-C port.', power: 'Source: 5–15 W while cranking.', specs: [], guide: '#g-power',
  },
  starlink: {
    name: 'Starlink Mini + 12 V LiFePO4 bank (optional)', short: 'Starlink Mini', cat: 'sat', tier: 3,
    part: 'Starlink Mini + 300–500 Wh LiFePO4 + 100 W panel', price: '$700–1,300 + subscription', buy: [['Starlink Mini power specs', 'https://starlink.com/support/article/a7fe6525-5356-a837-48e6-33df176cdbc5']],
    what: 'The only option here that gives real internet: email, messaging apps, and a gateway that links the whole neighborhood mesh to the internet. It draws about 25–40 W, so it gets its own big battery and runs only when needed.',
    why: 'Too power-hungry for the handheld hub battery.', connects: 'Wi-Fi to your phone; the hub can join it to relay messages.', power: '20–40 W average.', specs: [], guide: '#g-carry',
  },
  pack: {
    name: 'Backpack carrier (30–40 L)', short: 'Backpack', cat: 'rugged', tier: 1,
    part: 'A 30–40 L pack with a hydration sleeve, hip belt and webbing', price: '$60–150', buy: [],
    what: 'The hub stands upright in the padded sleeve against your back, the most protected spot if you fall. Coax runs to a mast so the antennas sit above your head, the solar panel straps to the outside, and the sensor pod clips to the shoulder strap.',
    why: 'Carrying the hub frees your hands, and keeping it close to your spine balances the weight.', connects: '—', power: '—', specs: [['Size shown', '330 × 520 × 240 mm']], guide: '#g-pack',
  },
  packSolar: {
    name: 'Backpack solar panel (20 W)', short: 'Pack solar', cat: 'power', tier: 1, part: '20–28 W two-fold panel', price: '$60–120', buy: [],
    what: 'Charges while you walk or while the pack hangs in a tree. Angle and shade keep changing, so treat it as a top-up.', why: '', connects: 'USB-C → hub.', power: 'Source.', specs: [], guide: '#g-pack',
  },
  mast: {
    name: 'Antenna mast', short: 'Antenna mast', cat: 'brain', tier: 1, part: 'Telescoping fiberglass pole + low-loss coax', price: '$30–80', buy: [],
    what: 'Lifts the LoRa and Iridium antennas above your head. Your body absorbs radio signals, and height adds range.', why: '', connects: 'Coax from the lid bulkheads.', power: '—', specs: [], guide: '#g-pack',
  },
  iridiumSat: {
    name: 'Iridium satellite (not to scale)', short: 'Iridium satellite', cat: 'sat', tier: 1, part: '66 active low-Earth-orbit satellites at about 780 km', price: '—', buy: [],
    what: 'Iridium satellites pass messages to each other in orbit until one is over a ground station, which is why coverage is truly global. At true scale this one would be about 780 km up.', why: '', connects: 'L-band radio, about 1.6 GHz.', power: '—', specs: [], guide: '#g-journey',
  },
};

// Aliases: clicking these nodes selects another component
export const ALIAS = { sosCover: 'sos' };

// ---------------------------------------------------------------------------------------------
// Connections: what each wire bus / radio link does (shown in the "Connect" tab)
// ---------------------------------------------------------------------------------------------
export const LINKS = {
  pwr: {
    title: 'Power wiring', color: '#ef4444', kind: 'wire',
    html: `<p>Energy flows one way: <b>sources → charger → battery and system rail → each module</b>.</p>
<ul><li><b>Battery</b> (3.0–4.2 V) → fuse → charger BAT. The charger runs the hub and charges the battery at the same time ("power path").</li>
<li><b>LOAD rail</b> (≤ 4.4 V) → controller and mesh radio battery inputs. Each has its own 3.3 V regulator.</li>
<li><b>5 V boost</b> (switched by a controller pin) → RockBLOCK V_IN+ and the particle sensor. Off between messages to save power.</li>
<li><b>STEMMA QT power</b> (switched by GPIO7) → I²C sensors, off in sleep.</li>
<li>All grounds join at one point. Every signal is measured against ground, so a missing ground wire breaks everything.</li></ul>`,
    guide: '#g-pwrwire',
  },
  uart: {
    title: 'UART (serial): 3 links', color: '#facc15', kind: 'wire',
    html: `<p>Two wires per link, <b>crossed</b>: my TX goes to your RX. There is no clock wire, so both sides agree on a speed (the baud rate) in advance.</p>
<ul><li><b>Controller ↔ RockBLOCK</b>: 230400 baud, fixed. The modem speaks Iridium's JSON-based JSPR protocol; the Ground Control library hides it behind <code>rbSendMessage()</code>.</li>
<li><b>Controller ↔ mesh radio</b>: Meshtastic Serial module in <code>PROTO</code> mode, the same API the phone app uses. Each frame is <code>0x94 0xC3</code>, then a 2-byte length, then a protobuf message (512 bytes max).</li>
<li><b>Controller ↔ methane sensor</b>: typically 9600 baud, 9-byte frames starting with <code>0xFF</code>.</li></ul>`,
    guide: '#g-uart',
  },
  i2c: {
    title: 'I²C bus: two wires, many sensors', color: '#3b82f6', kind: 'wire',
    html: `<p>One data line (<b>SDA</b>) and one clock line (<b>SCL</b>) shared by every sensor. Each device answers to its own 7-bit <b>address</b>, so the controller "calls" one at a time.</p>
<table class="mini-t"><tr><td>0x42</td><td>GNSS (MAX-M10S)</td></tr><tr><td>0x18</td><td>Motion (LIS3DH)</td></tr><tr><td>0x36</td><td>Battery gauge (MAX17048, on the Feather)</td></tr><tr><td>0x62</td><td>CO₂ (SCD-41)</td></tr><tr><td>0x77</td><td>Temp / humidity / pressure (BME280)</td></tr><tr><td>0x12</td><td>Particles (PMSA003I)</td></tr><tr><td>0x70–0x73</td><td>Oxygen (DFRobot)</td></tr><tr><td>dial</td><td>CO (DFRobot SEN0466)</td></tr></table>
<p>Qwiic / STEMMA QT cables carry GND, 3.3 V, SDA and SCL, so you plug boards in a chain without soldering.</p>`,
    guide: '#g-i2c',
  },
  spi: {
    title: 'SPI: the e-paper display', color: '#a855f7', kind: 'wire',
    html: `<p>A fast, clocked link for one device per chip-select wire. The display is write-only, so only the controller talks: <b>SCK</b> (clock), <b>MOSI/DIN</b> (data), <b>CS</b> (it's you), <b>DC</b> (data or command), <b>RST</b>, and <b>BUSY</b>, which the panel raises while it repaints.</p>`,
    guide: '#g-spi',
  },
  gpio: {
    title: 'GPIO: switch, buttons, buzzer, enables', color: '#e5e7eb', kind: 'wire',
    html: `<ul><li><b>SOS switch & buttons</b>: inputs with pull-ups. Pressing one connects the pin to ground (LOW), and that edge can wake the ESP32 from deep sleep.</li>
<li><b>Buzzer</b>: PWM square wave. <b>LED</b>: on/off through a resistor.</li>
<li><b>RockBLOCK I_EN / I_BTD</b>: raise I_EN to turn the modem on, wait until I_BTD goes HIGH ("booted"), then start talking. To shut down: stop talking, drop I_EN, wait for I_BTD to go LOW.</li>
<li><b>Boost EN</b>, <b>IMU INT1</b>: power control and motion wake-up.</li></ul>`,
    guide: '#g-gpio',
  },
  rf: {
    title: 'RF coax: antennas', color: '#d4a52a', kind: 'wire',
    html: `<p>Radio-frequency signals travel on <b>coaxial cable</b>, not ordinary wire. Tiny u.FL connectors on the boards go to sealed SMA bulkheads in the lid.</p>
<ul><li>LoRa: RAK4631 → LoRa whip (915 MHz)</li><li>Iridium: RockBLOCK → helical (1.6 GHz)</li><li>GNSS: receiver → patch inside the lid</li></ul>
<p>Keep coax short; every extra centimetre loses signal. u.FL connectors survive only a few dozen connect/disconnect cycles.</p>`,
    guide: '#g-rf',
  },
  ble: {
    title: 'Bluetooth LE: phone ↔ mesh radio', color: '#60a5fa', kind: 'air',
    html: `<p>Open the <b>Meshtastic app</b>, scan, and pair with the radio. With no screen attached it uses a fixed PIN (default <code>123456</code>; change it). You then type messages, see the mesh map and share your position.</p>
<p>Under the hood the radio offers a Bluetooth "service" with three "characteristics": the phone writes <b>ToRadio</b> packets, reads <b>FromRadio</b> packets, and gets a <b>FromNum</b> notification when something new arrives.</p>`,
    guide: '#g-phone',
  },
  wifi: {
    title: 'Wi-Fi: phone ↔ hub web page', color: '#34d399', kind: 'air',
    html: `<p>The controller creates its own Wi-Fi network (e.g. <code>SURVIVAL-HUB</code>, password protected). Join it, open <b>http://192.168.4.1</b> in any browser, and you get the hub's page: battery, GPS fix, air readings, and a box to type a <b>satellite message</b>. No app and no internet are needed.</p>
<p>Your phone may warn "no internet connection". Choose to stay connected.</p>`,
    guide: '#g-phone',
  },
  lora: {
    title: 'LoRa mesh: hub ↔ neighbors', color: '#34d399', kind: 'air',
    html: `<p>Long-range, low-speed radio at 902–928 MHz, licence-free in the US. Messages hop from node to node (3 hops by default). They are encrypted with your channel key; the default channel's key is public, so make a private channel for your family.</p><p>Typical range is 2–5 km per hop, much farther from hills and rooftops.</p>`,
    guide: '#g-journey',
  },
  iridium: {
    title: 'Iridium: hub → satellite → your contacts', color: '#a78bfa', kind: 'air',
    html: `<p>The RockBLOCK sends a message (25 bytes to 100 KB) to a passing Iridium satellite. It is relayed to the ground and delivered by <b>Cloudloop</b> to email, a webhook, MQTT and other destinations, typically within seconds. Replies wait in Cloudloop until the hub's next check-in.</p>`,
    guide: '#g-journey',
  },
  gnss: {
    title: 'GNSS: satellites → hub (receive only)', color: '#94a3b8', kind: 'air',
    html: `<p>GPS, Galileo, GLONASS and BeiDou satellites broadcast precise time signals. Hearing four or more lets the receiver solve for your position. Nothing is transmitted, and it works with no network at all.</p>`,
    guide: '#g-loc',
  },
};

// ---------------------------------------------------------------------------------------------
// Bill of materials (also exported as downloads/bom.csv)
// ---------------------------------------------------------------------------------------------
export const BOM = [
  ['Brains & radios', 'Controller', 'Adafruit ESP32-S3 Feather (5477)', 1, '17.50', 'https://www.adafruit.com/product/5477'],
  ['Brains & radios', 'Mesh radio', 'RAK WisBlock Meshtastic Starter Kit (RAK4631 + RAK19007), US915', 1, '24.99', 'https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit'],
  ['Brains & radios', 'LoRa antenna + u.FL→SMA bulkhead pigtail', '915 MHz whip, SMA', 1, '10–30', ''],
  ['Satellite', 'Satellite modem', 'Ground Control RockBLOCK 9704 SMA', 1, '279.00', 'https://store.groundcontrol.com/products/rockblock-9704'],
  ['Satellite', 'Iridium antenna', 'Maxtena M1621HCT-P-SMA helical (passive)', 1, '80.00', 'https://store.groundcontrol.com/products/helical-iridium-certified-passive-antenna'],
  ['Satellite', 'Airtime', 'IMT: $15/month access + 64 KB pack $29', 1, '15/mo + data', 'https://groundcontrol.com/products/iridium-messaging-transport-imt-pricing/'],
  ['Location & motion', 'GNSS receiver', 'SparkFun MAX-M10S Qwiic (GPS-18037)', 1, '45.95', 'https://www.sparkfun.com/sparkfun-gnss-receiver-breakout-max-m10s-qwiic.html'],
  ['Location & motion', 'GNSS antenna', 'Active L1 patch with SMA cable', 1, '10–25', ''],
  ['Location & motion', 'Accelerometer', 'Adafruit LIS3DH STEMMA QT (2809)', 1, '4.95', 'https://www.adafruit.com/products/2809'],
  ['Sensors', 'CO₂ / temp / humidity', 'Adafruit SCD-41 (5190)', 1, '49.95', 'https://www.mouser.com/ProductDetail/485-5190'],
  ['Sensors', 'Particles (smoke/dust)', 'Adafruit PMSA003I breakout (4632)', 1, '44.95', 'https://www.adafruit.com/product/4632'],
  ['Sensors', 'Carbon monoxide', 'DFRobot SEN0466 (calibrated, I²C/UART)', 1, '66.90', 'https://www.dfrobot.com/product-2508.html'],
  ['Sensors', 'Oxygen', 'DFRobot SEN0322 (I²C)', 1, '67.16', 'https://www.robotshop.com/products/dfrobot-gravity-i2c-oxygen-sensor'],
  ['Sensors', 'Methane (natural gas)', 'Winsen MH-440D NDIR (UART)', 1, 'varies', 'https://www.winsen-sensor.com/product/mh-440d.html'],
  ['Sensors', 'Temp / humidity / pressure', 'Adafruit BME280 (2652)', 1, '~15', ''],
  ['Controls & display', 'E-paper display', 'Waveshare 2.9" e-Paper Module (SPI)', 1, '20–28', 'https://www.waveshare.com/2.9inch-e-Paper-Module.htm'],
  ['Controls & display', 'SOS switch', 'IP-rated toggle + flip-up safety cover', 1, '10–25', ''],
  ['Controls & display', 'Buttons, LED, buzzer, vibration motor', 'IP67 momentary pushbuttons ×3, LED, piezo, coin motor', 1, '15–35', ''],
  ['Power', 'Battery pack', '1S4P 21700 (~5 Ah cells) with BMS + 10k NTC', 1, '40–90', ''],
  ['Power', 'Charger / power path', 'Adafruit bq24074 Universal Charger (4755)', 1, '14.95', 'https://www.adafruit.com/products/4755'],
  ['Power', '5 V boost, fuse, TVS diodes', '1 A 5 V boost with enable pin; inline fuse; TVS', 1, '~10', ''],
  ['Power', 'Solar panel', '20–40 W folding panel with USB / 6–10 V output', 1, '60–150', ''],
  ['Power', 'Hand crank', 'USB hand-crank generator', 1, '40–100', ''],
  ['Enclosure & connectors', 'Case', 'Pelican 1200 (no foam)', 1, '70–85', 'https://innerspacecases.com/solutions/pelican-cases/small-cases/pelican-1200-no-foam-black/'],
  ['Enclosure & connectors', 'USB-C bulkhead', 'IP67 USB-C, e.g. Amphenol LTW UC-00PMFY-SC7001', 1, '20–40', 'https://www.digikey.com/en/products/detail/amphenol-ltw/UC-00PMFY-SC7001/9561519'],
  ['Enclosure & connectors', 'DC-IN + pod connectors', 'M12 2-pin and 8-pin panel connectors + cordset', 1, '30–70', ''],
  ['Enclosure & connectors', 'SMA bulkheads, coax, Qwiic cables, standoffs', 'O-ring SMA bulkheads ×2, STEMMA QT cables, M2.5 brass standoffs', 1, '25–50', ''],
  ['Enclosure & connectors', 'Printed parts', 'Mounting plate, battery cradle, control-panel bezel, sensor-pod shell (STL downloads)', 1, '~10 filament', ''],
  ['Carry-along', '406 MHz PLB (buy + register with NOAA)', 'ACR ResQLink or Ocean Signal rescueME', 1, '300–450', ''],
  ['Carry-along', 'SDR receiver (receive only)', 'RTL-SDR Blog V4 + dipole kit, Raspberry Pi Zero 2 W, microSD', 1, '60–90', 'https://www.rtl-sdr.com/rtl-sdr-blog-v4-dongle-initial-release/'],
  ['Carry-along', 'Ham radio handheld with APRS (license needed)', 'Yaesu FT-5DR or Kenwood TH-D75', 1, '400–650', ''],
];
