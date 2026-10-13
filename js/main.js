import { Stepper } from '/stepper.js'
import * as wifi from 'wifi'
import { startHttp } from '/http.js'

const PIN_EN = 4
const PIN_STEP = 5
const PIN_DIR = 6

/** Existing Wi-Fi network (STA mode). Replace before flashing. */
const STA_SSID = 'YOUR_SSID'
const STA_PWD = 'YOUR_PASSWORD'
const HTTP_PORT = 80

/** C major up and down (C4 → C5 → C4). */
const SCALE = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
  'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4',
].map((note) => ({ note }))

const motor = new Stepper({
  en: PIN_EN,
  step: PIN_STEP,
  dir: PIN_DIR,
})

motor.init()
console.log('Stepper ready; C major up/down, bpm 120')
motor.playSequence({
  notes: SCALE,
  bpm: 120,
  defaultBeats: 1,
  legato: true,
})

;(async () => {
  console.log('Connecting to WiFi "' + STA_SSID + '"...')
  const ok = await wifi.connect(STA_SSID, STA_PWD, 10)
  if (!ok) {
    console.log('Failed to connect to "' + STA_SSID + '"')
    return
  }

  const status = await wifi.waitIP()
  if (!status || !status.ip) {
    console.log('Connected, but no IP received')
    return
  }
  console.log('WiFi connected, IP:', status.ip)

  startHttp(HTTP_PORT, () => ({
    ok: true,
    server: { name: 'beshell-step', version: '0.1.0' },
    stepper: motor.status(),
  }))

  console.log('curl http://' + status.ip + '/health')
  console.log('(MCP /mcp — next tag)')
})().catch((e) => {
  console.log('Startup error:', e)
})
