import * as gpio from 'gpio'
import { resolveNote } from '/notes.js'

const PWM_CHANNEL = 0
const PWM_TIMER = 0
/** 50% of 10-bit LEDC resolution (0–1023). */
const PWM_DUTY_ON = 512
/** Single polling ticker — BeShell JSTimer is unreliable with chained setTimeout/clearTimeout. */
const TICK_MS = 5
/** Fixed DIR level (clockwise for our wiring). */
const DIR_CW = 0
const DURATION_MS_MIN = 1
const DURATION_MS_MAX = 5000

const pwm = gpio.pwm

function assertPin(name, value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Stepper pin "${name}" must be a finite number`)
  }
}

/** @returns {number | null} */
function normalizeDurationMs(durationMs) {
  if (durationMs == null) {
    return null
  }
  const n = Math.round(Number(durationMs))
  if (!Number.isFinite(n)) {
    return null
  }
  return Math.min(DURATION_MS_MAX, Math.max(DURATION_MS_MIN, n))
}

/**
 * Stepper-as-tone: PWM on STEP at note frequency.
 *
 * Tone tag: playNote + timed stop.
 * Melody tag (later): playSequence extends the job/ticker loop.
 */
export class Stepper {
  /**
   * @param {{ en: number, step: number, dir: number }} pins
   */
  constructor(pins) {
    if (!pins) {
      throw new Error('Stepper requires { en, step, dir }')
    }
    assertPin('en', pins.en)
    assertPin('step', pins.step)
    assertPin('dir', pins.dir)

    this._pins = {
      en: pins.en,
      step: pins.step,
      dir: pins.dir,
    }

    this._ready = false
    /** True after the first pwm.config for STEP (required before pwm.write). */
    this._pwmConfigured = false
    this._tickTimer = -1

    /** @type {null | { deadline: number }} */
    this._job = null
    this._currentNote = null
  }

  /** Configure EN/DIR GPIO and start the shared ticker. Idempotent. */
  init() {
    if (this._ready) {
      return this
    }

    gpio.setMode(this._pins.en, 'output')
    gpio.setMode(this._pins.dir, 'output')
    gpio.write(this._pins.en, 0) // active-low enable on typical A4988/DRV8825 wiring
    gpio.write(this._pins.dir, DIR_CW)

    this._ensureTicker()
    this._ready = true
    return this
  }

  /**
   * Play one note. Optional duration schedules silence via the ticker.
   * @param {string} noteName
   * @param {number} [durationMs]
   */
  playNote(noteName, durationMs) {
    this._assertReady()
    const freq = resolveNote(noteName)

    // Drop previous deadline without silencing — tone config replaces the waveform.
    this._job = null

    this._configPwm(freq, PWM_DUTY_ON)
    this._currentNote = noteName

    const duration = normalizeDurationMs(durationMs)
    if (duration !== null) {
      this._job = { deadline: Date.now() + duration }
    }

    return { note: noteName, freq, durationMs: duration }
  }

  stop() {
    const lastNote = this._currentNote
    this._finishPlayback()
    return { stopped: true, lastNote }
  }

  status() {
    return {
      ready: this._ready,
      playing: this._currentNote !== null,
      note: this._currentNote,
    }
  }

  // --- internals -----------------------------------------------------------

  _assertReady() {
    if (!this._ready) {
      throw new Error('Stepper.init() required before playback')
    }
  }

  _ensureTicker() {
    if (this._tickTimer >= 0) {
      return
    }
    // Never clearInterval — one long-lived ticker; idle ticks are cheap no-ops
    // (~200/s while the process lives; BeShell timer bugs make start/stop risky).
    this._tickTimer = setInterval(() => this._onTick(), TICK_MS)
  }

  /**
   * Re-configures LEDC timer+channel. Stock BeShell has no pwm.setFreq —
   * frequency changes go through config() each time.
   */
  _configPwm(freqHz, duty) {
    pwm.config(this._pins.step, {
      freq: freqHz,
      duty,
      channel: PWM_CHANNEL,
      timer: PWM_TIMER,
    })
    this._pwmConfigured = true
  }

  /**
   * Mute STEP pulses. Prefer write(0) over pwm.stop():
   * stop() also drops the pin↔channel map in BeShell, so the next write would throw
   * until config() again. Duty 0 keeps the mapping and is enough for a silent STEP line.
   */
  _silence() {
    if (!this._pwmConfigured) {
      return
    }
    pwm.write(this._pins.step, 0)
  }

  _finishPlayback() {
    this._silence()
    this._currentNote = null
    this._job = null
  }

  /** Expired deadline → silence. Melody tag will branch on richer job shapes here. */
  _onTick() {
    const job = this._job
    if (!job || Date.now() < job.deadline) {
      return
    }
    this._finishPlayback()
  }
}
