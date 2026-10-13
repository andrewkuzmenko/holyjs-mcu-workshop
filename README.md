# mcu-js-holy-workshop

Демо для мастер-класса HolyJS:  
**«JS, микроконтроллеры и ИИ: MCP выходит в реальный мир»**

Текущий тег **`melody`**: BeShell + `Stepper.playSequence`, гамма **C-dur вверх и вниз**.

| | |
|---|---|
| Chip | ESP32-S3, **16MB flash**, **Octal PSRAM** |
| IDF | **5.5.x** |
| Target | `esp32s3` |
| JS | LittleFS partition `js` → `/main.js` |
| Stepper | EN **4** · STEP **5** · DIR **6** (PWM tone, DIR fixed CW) |

Предыдущие: `hello` · `stepper-tone`. Далее: `wifi-sta` → `http` → `mcp`.

---

## Требования

- Плата ESP32-S3 с **16MB flash** и **Octal PSRAM** (см. `sdkconfig.defaults`)
- Драйвер шаговика (STEP/DIR/EN) на пинах выше
- [ESP-IDF 5.5](https://docs.espressif.com/projects/esp-idf/en/v5.5.2/esp32s3/get-started/index.html)

---

## Быстрый старт

```bash
git clone -b melody https://github.com/andrewkuzmenko/holyjs-mcu-workshop.git mcu-js-holy-workshop
cd mcu-js-holy-workshop

. $IDF_PATH/export.sh
idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

В мониторе:

```text
Stepper ready; C major up/down, bpm 120
```

и гамма C4→C5→C4 на моторе.

С `stepper-tone` обычно достаточно обновить JS-раздел:

```bash
idf.py build
parttool.py --port PORT write_partition --partition-name=js --input build/js.bin
```

---

## API (кратко)

```javascript
import { Stepper } from '/stepper.js'

const motor = new Stepper({ en: 15, step: 16, dir: 18 })
motor.init()

motor.playNote('A4', 5000)

motor.playSequence({
  notes: [
    { note: 'C4' },
    { note: 'E4', durationMs: 300 },
    { note: 'rest', beats: 1 },
  ],
  bpm: 120,
  defaultBeats: 1,
  legato: true,
})
```

Элемент `notes[]` всегда `{ note, durationMs? | beats? }`.  
Длительность: `durationMs` → `beats`+`bpm` → `defaultBeats`+`bpm` → `defaultDurationMs`.  
`durationMs` clamp **1..5000**. Rest: `{ note: 'rest', … }`.

Частота — stock `gpio.pwm.config` (без патча `setFreq`).

---

## Файлы

```text
js/main.js       — C major up/down через playSequence
js/stepper.js    — class Stepper (playNote + playSequence)
js/notes.js      — целые Гц A0–C8
```

---

## Теги

| Tag | Содержимое |
|-----|------------|
| `hello` | `console.log` |
| `stepper-tone` | одна нота A4 5 с |
| `melody` | C-dur up/down |
| `wifi-sta` | melody + Wi‑Fi STA |
| `http` | + HTTP `/health` |
| `mcp` | HTTP + MCP tools |

Далее: `wifi-sta` → `http` → `mcp`.

## Как залить на MCU только JS

- `idf.py build`
- `esptool.py --chip esp32s3 -p PORT write_flash 0x310000 build/js.bin`

После прошивки — reset или `idf.py -p PORT monitor`.

## Если `idf.py build` падает на `mklittlefs: Permission denied`

Это нормально при первой сборке: менеджер компонентов скачивает `beshell` без бита исполнения на утилите, которая собирает образ JS. Выставить права и повторить:

```bash
chmod +x managed_components/become-cool__beshell/tools/mklittlefs*
idf.py build
```

macOS, если после `chmod` всё равно не запускается (Gatekeeper):

```bash
xattr -d com.apple.quarantine managed_components/become-cool__beshell/tools/mklittlefs-darwin
```

На Windows не возникает (`mklittlefs.exe`).

---

## Без платы

Уровень `hello` можно повторить в браузере: [docs/WOKWI.md](docs/WOKWI.md) (готовый UF2, без облачной сборки).
