import { Stepper } from '/stepper.js'

const PIN_EN = 4
const PIN_STEP = 5
const PIN_DIR = 6

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
