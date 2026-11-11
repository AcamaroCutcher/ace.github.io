/*
 * robot_firmware.ino - the "spinal cord" of a two-wheeled robot (Arduino Uno or Nano).
 *
 * The microcontroller does the fast, safety-critical work; the agent on the Raspberry Pi or
 * laptop does the slow thinking. They talk over USB serial, one text command per line:
 *
 *   M <left> <right> <ms>   run the motors (-255..255 each) for at most <ms> milliseconds, then stop
 *   S                       stop now
 *   D                       measure the distance ahead in cm with the ultrasonic sensor
 *   P                       ping (replies OK P)
 *
 * Safety lives here, below the AI, where no prompt can change it:
 *   - every motion ends on its own after <ms> (max 2000), so a crashed agent can't leave motors running
 *   - forward motion is refused, or cut, when something is closer than STOP_CM
 *
 * Hardware: TB6612FNG dual motor driver, HC-SR04 ultrasonic sensor, two DC gear motors,
 * a separate battery for the motors (share ground with the Arduino).
 * Not compiled while preparing the course: check pin numbers against your own wiring.
 */

const int PWMA = 5, AIN1 = 7, AIN2 = 8;    // left motor
const int PWMB = 6, BIN1 = 9, BIN2 = 10;   // right motor
const int STBY = 4;                        // driver standby: LOW = everything off
const int TRIG = 11, ECHO = 12;            // ultrasonic sensor

const int STOP_CM = 15;
const unsigned long MAX_MS = 2000;

unsigned long stopAt = 0;     // when the current motion must end (0 = not moving)
bool movingForward = false;
String line;

void setMotor(int pwmPin, int in1, int in2, int speed) {
  speed = constrain(speed, -255, 255);
  digitalWrite(in1, speed > 0);
  digitalWrite(in2, speed < 0);
  analogWrite(pwmPin, abs(speed));
}

void stopMotors() {
  setMotor(PWMA, AIN1, AIN2, 0);
  setMotor(PWMB, BIN1, BIN2, 0);
  stopAt = 0;
  movingForward = false;
}

int distanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 25000UL);   // time out after ~4 m
  if (us == 0) return 400;                           // no echo: treat as "far"
  return (int)(us / 58UL);                           // sound: ~58 us per cm, there and back
}

void handle(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  char op = cmd.charAt(0);
  if (op == 'S') {
    stopMotors();
    Serial.println("OK S");
  } else if (op == 'P') {
    Serial.println("OK P");
  } else if (op == 'D') {
    Serial.print("D ");
    Serial.println(distanceCm());
  } else if (op == 'M') {
    int left = 0, right = 0;
    long ms = 0;
    if (sscanf(cmd.c_str(), "M %d %d %ld", &left, &right, &ms) != 3 || ms <= 0) {
      Serial.println("ERR usage: M <left> <right> <ms>");
      return;
    }
    bool forward = left > 0 && right > 0;
    if (forward && distanceCm() < STOP_CM) {
      Serial.println("ERR obstacle");
      return;
    }
    setMotor(PWMA, AIN1, AIN2, left);
    setMotor(PWMB, BIN1, BIN2, right);
    stopAt = millis() + min((unsigned long)ms, MAX_MS);
    movingForward = forward;
    Serial.println("OK M");
  } else {
    Serial.println("ERR unknown command");
  }
}

void setup() {
  pinMode(PWMA, OUTPUT); pinMode(AIN1, OUTPUT); pinMode(AIN2, OUTPUT);
  pinMode(PWMB, OUTPUT); pinMode(BIN1, OUTPUT); pinMode(BIN2, OUTPUT);
  pinMode(STBY, OUTPUT); pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  digitalWrite(STBY, HIGH);
  stopMotors();
  Serial.begin(115200);
  Serial.println("READY");
}

void loop() {
  while (Serial.available()) {               // read a line without blocking the loop
    char c = Serial.read();
    if (c == '\n') { handle(line); line = ""; }
    else if (line.length() < 40) line += c;
  }
  if (stopAt && (long)(millis() - stopAt) >= 0) stopMotors();              // motion timer ran out
  static unsigned long lastCheck = 0;
  if (movingForward && millis() - lastCheck > 60) {                         // reflex: obstacle ahead
    lastCheck = millis();
    if (distanceCm() < STOP_CM) { stopMotors(); Serial.println("EVENT obstacle_stop"); }
  }
}
