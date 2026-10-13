import { Stepper } from '/stepper.js'
import * as wifi from 'wifi'

const PIN_EN = 4
const PIN_STEP = 5
const PIN_DIR = 6

/** Existing Wi-Fi network (STA mode). Replace before flashing. */
const STA_SSID = 'YOUR_SSID'
const STA_PWD = 'YOUR_PASSWORD'
const HTTP_PORT = 80

const SERVER_INFO = {
  name: 'beshell-step',
  version: '0.1.0',
}

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

  // Keep the link alive on stage: no modem sleep (fewer beacon timeouts)
  // and a daemon that re-connects if the AP drops us.
  wifi.setPS(0)
  wifi.startStaDeamon(5000)
  wifi.on('sta.disconnected', () => {
    console.log('WiFi lost, reconnecting...')
  })
  wifi.on('ip.got', (info) => {
    console.log('WiFi back, IP:', info.ip)
  })

  const { HttpServer } = await import('/http.js')
  const { McpServer } = await import('/mcp.js')
  const { createStepperTools } = await import('/tools.js')

  const http = new HttpServer(HTTP_PORT)
  const mcp = new McpServer({
    serverInfo: SERVER_INFO,
    tools: createStepperTools(motor),
    getStatus: () => ({ stepper: motor.status() }),
  })
  mcp.mount(http)
  http.listen()

  console.log('curl http://' + status.ip + '/health')
  console.log('MCP URL: http://' + status.ip + '/mcp')
  console.log('System ready.')
})().catch((e) => {
  console.log('Startup error:', e)
})
