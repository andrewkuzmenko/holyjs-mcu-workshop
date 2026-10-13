import { Stepper } from '/stepper.js'

const PIN_EN = 4
const PIN_STEP = 5
const PIN_DIR = 6

const NOTE = 'A4'
const DURATION_MS = 5000

const motor = new Stepper({
  en: PIN_EN,
  step: PIN_STEP,
  dir: PIN_DIR,
})

motor.init()
console.log('Stepper ready; playing', NOTE, 'for', DURATION_MS, 'ms')
motor.playNote(NOTE, DURATION_MS)
