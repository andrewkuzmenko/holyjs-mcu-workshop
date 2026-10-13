import { NOTE_NAMES } from '/notes.js'

/**
 * MCP tool wire format stays snake_case (Cursor / participant docs).
 * Stepper public API is camelCase — this module is the adapter.
 */

function okText(text) {
  return {
    content: [{ type: 'text', text: String(text) }],
  }
}

function errText(text) {
  return {
    content: [{ type: 'text', text: String(text) }],
    isError: true,
  }
}

/**
 * Normalize MCP note items → Stepper `{ note, durationMs?, beats? }`.
 * Accepts strings, camelCase objects, and snake_case objects from the old API.
 */
export function normalizeMcpNotes(notes) {
  if (!Array.isArray(notes)) {
    throw new Error('notes must be an array')
  }

  const out = []
  for (let i = 0; i < notes.length; i++) {
    const label = 'notes[' + i + ']'
    const raw = notes[i]

    if (typeof raw === 'string') {
      out.push({ note: raw })
      continue
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(label + ' must be a string or object')
    }

    if (raw.rest === true) {
      out.push({
        note: 'rest',
        durationMs: pickDuration(raw),
        beats: raw.beats,
      })
      continue
    }

    if (typeof raw.note !== 'string' && raw.note != null) {
      throw new Error(label + '.note must be a string')
    }

    out.push({
      note: raw.note,
      durationMs: pickDuration(raw),
      beats: raw.beats,
    })
  }
  return out
}

function pickDuration(raw) {
  if (raw.durationMs != null) {
    return raw.durationMs
  }
  if (raw.duration_ms != null) {
    return raw.duration_ms
  }
  return undefined
}

/**
 * Registry of MCP tools: schema for tools/list + handler for tools/call.
 */
export class ToolRegistry {
  constructor() {
    /** @type {{ name: string, description: string, inputSchema: object, handler: Function }[]} */
    this._tools = []
  }

  /**
   * @param {{ name: string, description: string, inputSchema: object, handler: (args: object) => object }} def
   */
  register(def) {
    if (!def || !def.name || typeof def.handler !== 'function') {
      throw new Error('tool requires name and handler')
    }
    this._tools.push({
      name: def.name,
      description: def.description || '',
      inputSchema: def.inputSchema || { type: 'object', properties: {} },
      handler: def.handler,
    })
    return this
  }

  /** Schemas only (no handlers) for tools/list. */
  listSchemas() {
    return this._tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  }

  /**
   * @param {string} name
   * @param {object} [args]
   */
  call(name, args) {
    for (let i = 0; i < this._tools.length; i++) {
      if (this._tools[i].name === name) {
        try {
          return this._tools[i].handler(args || {})
        } catch (e) {
          return errText(e && e.message ? e.message : String(e))
        }
      }
    }
    return errText('Unknown tool: ' + name)
  }
}

/**
 * @param {import('/stepper.js').Stepper} motor
 * @returns {ToolRegistry}
 */
export function createStepperTools(motor) {
  const tools = new ToolRegistry()

  tools.register({
    name: 'list_notes',
    description:
      'List all available note names that can be passed to play_note (scientific pitch A0..C8)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler() {
      return okText(
        JSON.stringify({
          count: NOTE_NAMES.length,
          range: 'A0..C8',
          notes: NOTE_NAMES,
        }),
      )
    },
  })

  tools.register({
    name: 'play_note',
    description:
      'Play a musical note on the stepper motor via PWM STEP pin. Optionally auto-stop after duration_ms. Call list_notes to see valid note names.',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description:
            'Scientific pitch A0..C8 (88 piano keys). Sharps: Cs/Ds/Fs/Gs/As. Examples: A4, C4, Fs5, C8',
        },
        duration_ms: {
          type: 'number',
          description:
            'How long to play the note in milliseconds. If omitted, plays until stop().',
        },
      },
      required: ['note'],
    },
    handler(args) {
      const duration =
        args.duration_ms != null ? args.duration_ms : args.durationMs
      const result = motor.playNote(args.note, duration)
      let msg =
        'Playing ' + result.note + ' (' + Math.round(result.freq) + ' Hz)'
      if (result.durationMs != null) {
        msg += ', duration=' + result.durationMs + ' ms'
      }
      return okText(msg)
    },
  })

  tools.register({
    name: 'play_sequence',
    description:
      'Play a melody on-device (timers switch notes locally; no network between notes). legato=true keeps PWM on and only changes frequency; gap_ms inserts silence (staccato). Durations: duration_ms per note, or beats with bpm (and optional default_beats / default_duration_ms). Rests: note "rest"/"R"/"-" or {rest:true}.',
    inputSchema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          description:
            'Sequence items: string note name, or {note, duration_ms?} / {note, beats?} / {rest:true, duration_ms|beats}',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  note: { type: 'string' },
                  rest: { type: 'boolean' },
                  duration_ms: { type: 'number' },
                  beats: { type: 'number' },
                },
              },
            ],
          },
        },
        gap_ms: {
          type: 'number',
          description: 'Silence between notes in ms (staccato). Default 0.',
        },
        legato: {
          type: 'boolean',
          description:
            'If true (default), do not mute PWM between notes when gap_ms=0 — only change frequency.',
        },
        bpm: {
          type: 'number',
          description: 'Tempo for beat-based durations. quarter note = 1 beat.',
        },
        default_duration_ms: {
          type: 'number',
          description: 'Fallback duration for items without duration_ms/beats.',
        },
        default_beats: {
          type: 'number',
          description:
            'Fallback beat length when bpm is set and item has no duration.',
        },
      },
      required: ['notes'],
    },
    handler(args) {
      const result = motor.playSequence({
        notes: normalizeMcpNotes(args.notes),
        gapMs: args.gap_ms != null ? args.gap_ms : args.gapMs,
        legato: args.legato,
        bpm: args.bpm,
        defaultDurationMs:
          args.default_duration_ms != null
            ? args.default_duration_ms
            : args.defaultDurationMs,
        defaultBeats:
          args.default_beats != null ? args.default_beats : args.defaultBeats,
      })
      return okText(
        'Sequence started: ' +
          result.count +
          ' steps, ~' +
          result.totalMs +
          ' ms, legato=' +
          result.legato +
          ', gap_ms=' +
          result.gapMs +
          (result.bpm ? ', bpm=' + result.bpm : '') +
          ' [' +
          result.notes.join(' ') +
          ']',
      )
    },
  })

  tools.register({
    name: 'stop',
    description: 'Stop the stepper PWM output (cancels play_note / play_sequence)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler() {
      const result = motor.stop()
      return okText(
        'Stopped' + (result.lastNote ? ' (was ' + result.lastNote + ')' : ''),
      )
    },
  })

  return tools
}
