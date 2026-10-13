/** Integer Hz for LEDC (rounded scientific pitch, A4 = 440). Sharps: Cs/Ds/Fs/Gs/As. */
export const NOTES = {
  A0: 28, As0: 29, B0: 31, C1: 33,
  Cs1: 35, D1: 37, Ds1: 39, E1: 41,
  F1: 44, Fs1: 46, G1: 49, Gs1: 52,
  A1: 55, As1: 58, B1: 62, C2: 65,
  Cs2: 69, D2: 73, Ds2: 78, E2: 82,
  F2: 87, Fs2: 93, G2: 98, Gs2: 104,
  A2: 110, As2: 117, B2: 123, C3: 131,
  Cs3: 139, D3: 147, Ds3: 156, E3: 165,
  F3: 175, Fs3: 185, G3: 196, Gs3: 208,
  A3: 220, As3: 233, B3: 247, C4: 262,
  Cs4: 277, D4: 294, Ds4: 311, E4: 330,
  F4: 349, Fs4: 370, G4: 392, Gs4: 415,
  A4: 440, As4: 466, B4: 494, C5: 523,
  Cs5: 554, D5: 587, Ds5: 622, E5: 659,
  F5: 698, Fs5: 740, G5: 784, Gs5: 831,
  A5: 880, As5: 932, B5: 988, C6: 1047,
  Cs6: 1109, D6: 1175, Ds6: 1245, E6: 1319,
  F6: 1397, Fs6: 1480, G6: 1568, Gs6: 1661,
  A6: 1760, As6: 1865, B6: 1976, C7: 2093,
  Cs7: 2217, D7: 2349, Ds7: 2489, E7: 2637,
  F7: 2794, Fs7: 2960, G7: 3136, Gs7: 3322,
  A7: 3520, As7: 3729, B7: 3951, C8: 4186,
}

/** Scientific pitch names in NOTES table order. */
export const NOTE_NAMES = Object.keys(NOTES)

/**
 * @param {string} name
 * @returns {number} frequency Hz (integer)
 */
export function resolveNote(name) {
  const freq = NOTES[name]
  if (freq === undefined) {
    throw new Error(
      `Unknown note: ${name}. Use scientific pitch A0..C8 ` +
      '(sharps as Cs/Ds/Fs/Gs/As), e.g. A4, C4, Fs5'
    )
  }
  return freq
}
