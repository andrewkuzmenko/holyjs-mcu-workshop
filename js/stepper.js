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
const MAX_SEQUENCE_NOTES = 256

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

function positiveNumber(value, label) {
  const n = Number(value)
  if (!Number.isFinite(n) || !(n > 0)) {
    throw new Error(label + ' must be a positive number')
  }
  return n
}

function isRestNote(name) {
  if (name == null) {
    return true
  }
  if (typeof name !== 'string') {
    return false
  }
  const n = name.toLowerCase()
  return n === '' || n === 'rest' || n === 'r' || n === '-' || n === '.'
}

/**
 * Resolve one step duration: item.durationMs → item.beats+bpm →
 * defaultBeats+bpm → defaultDurationMs.
 */
function resolveStepDurationMs(item, opts, label) {
  if (item.durationMs != null) {
    const clamped = normalizeDurationMs(item.durationMs)
    if (clamped === null) {
      throw new Error(label + '.durationMs must be a number')
    }
    return clamped
  }

  const beats = item.beats != null ? item.beats : opts.defaultBeats
  if (beats != null) {
    if (opts.bpm == null) {
      throw new Error(label + ': beats require bpm')
    }
    const bpm = positiveNumber(opts.bpm, 'bpm')
    const b = positiveNumber(beats, label + '.beats')
    return normalizeDurationMs((60000 / bpm) * b) || DURATION_MS_MIN
  }

  if (opts.defaultDurationMs != null) {
    const clamped = normalizeDurationMs(opts.defaultDurationMs)
    if (clamped === null) {
      throw new Error('defaultDurationMs must be a number')
    }
    return clamped
  }

  throw new Error(
    label + ': need durationMs, or beats+bpm, or defaultBeats+bpm / defaultDurationMs'
  )
}

/**
 * Uniform note items: `{ note, durationMs? | beats? }`.
 * @returns {{ note: string|null, freq: number|null, durationMs: number }[]}
 */
function normalizeSequence(rawNotes, opts) {
  if (!Array.isArray(rawNotes) || rawNotes.length === 0) {
    throw new Error('notes must be a non-empty array')
  }
  if (rawNotes.length > MAX_SEQUENCE_NOTES) {
    throw new Error('notes length must be <= ' + MAX_SEQUENCE_NOTES)
  }

  const out = []
  for (let i = 0; i < rawNotes.length; i++) {
    const label = 'notes[' + i + ']'
    const raw = rawNotes[i]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(label + ' must be an object { note, durationMs? | beats? }')
    }
    if (typeof raw.note !== 'string' && raw.note != null) {
      throw new Error(label + '.note must be a string')
    }

    const durationMs = resolveStepDurationMs(raw, opts, label)
    if (isRestNote(raw.note)) {
      out.push({ note: null, freq: null, durationMs })
      continue
    }

    out.push({
      note: raw.note,
      freq: resolveNote(raw.note),
      durationMs,
    })
  }
  return out
}

/**
 * Stepper-as-tone: PWM on STEP at note frequency.
 * playNote — single tone; playSequence — on-device melody via the shared ticker.
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

    /** @type {null | object} */
    this._job = null
    this._currentNote = null
    this._seqIndex = -1
    this._seqLength = 0
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

    this._job = null
    this._seqIndex = -1
    this._seqLength = 0

    this._configPwm(freq, PWM_DUTY_ON)
    this._currentNote = noteName

    const duration = normalizeDurationMs(durationMs)
    if (duration !== null) {
      this._job = { kind: 'note', deadline: Date.now() + duration }
    }

    return { note: noteName, freq, durationMs: duration }
  }

  /**
   * Play a melody on-device (ticker switches notes; no host between steps).
   *
   * @param {object} options
   * @param {{ note: string, durationMs?: number, beats?: number }[]} options.notes
   * @param {number} [options.bpm]
   * @param {number} [options.defaultBeats]
   * @param {number} [options.defaultDurationMs]
   * @param {boolean} [options.legato=true]
   * @param {number} [options.gapMs=0]
   */
  playSequence(options) {
    this._assertReady()
    const opts = options || {}
    if (!opts.notes) {
      throw new Error('playSequence requires notes')
    }

    let gapMs = opts.gapMs == null ? 0 : Number(opts.gapMs)
    if (!Number.isFinite(gapMs) || gapMs < 0) {
      gapMs = 0
    }
    gapMs = Math.round(gapMs)

    const legato = opts.legato == null ? true : !!opts.legato
    const steps = normalizeSequence(opts.notes, opts)

    let totalMs = 0
    for (let i = 0; i < steps.length; i++) {
      totalMs += steps[i].durationMs
      if (i < steps.length - 1) {
        totalMs += gapMs
      }
    }

    this._job = null
    this._seqLength = steps.length
    this._seqIndex = 0

    const t0 = Date.now()
    const deadline = this._beginStep(steps[0], t0)

    this._job = {
      kind: 'seq',
      steps,
      index: 0,
      phase: 'note',
      gapMs,
      legato,
      deadline,
    }

    return {
      count: steps.length,
      legato,
      gapMs,
      bpm: opts.bpm != null ? opts.bpm : null,
      totalMs: Math.round(totalMs),
      notes: steps.map((s) => (s.note === null ? 'rest' : s.note)),
    }
  }

  stop() {
    const lastNote = this._currentNote
    this._finishPlayback()
    return { stopped: true, lastNote }
  }

  status() {
    return {
      ready: this._ready,
      playing: this._currentNote !== null || this._job !== null,
      note: this._currentNote,
      sequence: this._seqLength > 0
        ? { index: this._seqIndex, length: this._seqLength }
        : null,
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

  /** Snapshot for /health and later MCP. */
  status() {
    return {
      playing: this._job != null,
      note: this._currentNote,
      dir: DIR_CW,
      sequence:
        this._seqLength > 0
          ? { index: this._seqIndex, length: this._seqLength }
          : null,
    }
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
    this._seqIndex = -1
    this._seqLength = 0
  }

  /** @returns {number} deadline ms */
  _beginStep(step, atMs) {
    if (step.note === null) {
      this._silence()
      this._currentNote = null
    } else {
      this._configPwm(step.freq, PWM_DUTY_ON)
      this._currentNote = step.note
    }
    return atMs + step.durationMs
  }

  _advanceSequence() {
    const job = this._job
    if (!job || job.kind !== 'seq') {
      return
    }

    if (job.phase === 'note') {
      if (job.index >= job.steps.length - 1) {
        this._finishPlayback()
        return
      }

      if (job.gapMs > 0) {
        this._silence()
        this._currentNote = null
        job.phase = 'gap'
        job.deadline = job.deadline + job.gapMs
        return
      }

      if (!job.legato) {
        this._silence()
        this._currentNote = null
      }

      job.index += 1
      this._seqIndex = job.index
      job.phase = 'note'
      job.deadline = this._beginStep(job.steps[job.index], job.deadline)
      return
    }

    // gap finished → next note
    job.index += 1
    this._seqIndex = job.index
    job.phase = 'note'
    job.deadline = this._beginStep(job.steps[job.index], job.deadline)
  }

  _onTick() {
    if (!this._job) {
      return
    }

    // Catch up if a tick was delayed (keep tempo from absolute deadlines).
    let guard = 0
    while (this._job && Date.now() >= this._job.deadline && guard < 64) {
      guard += 1
      if (this._job.kind === 'note') {
        this._finishPlayback()
        return
      }
      if (this._job.kind === 'seq') {
        this._advanceSequence()
        continue
      }
      this._finishPlayback()
      return
    }
  }
}
