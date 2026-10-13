# mcu-js-holy-workshop

Демо для мастер-класса HolyJS:  
**«JS, микроконтроллеры и ИИ: MCP выходит в реальный мир»**

Текущий тег **`hello`**: BeShell (QuickJS) на ESP32-S3 и `console.log('hello from ESP32-S3')` в serial.

| | |
|---|---|
| Chip | ESP32-S3, **16MB flash**, **Octal PSRAM** |
| IDF | **5.5.x** |
| Target | `esp32s3` |
| JS | LittleFS partition `js` → `/main.js` |

Дальше: `stepper-tone` → `melody` → `wifi-sta` → `http` → `mcp`.

---

## Требования

- Плата ESP32-S3 с **16MB flash** и **Octal PSRAM** (см. `sdkconfig.defaults`)
- USB-кабель
- [ESP-IDF 5.5](https://docs.espressif.com/projects/esp-idf/en/v5.5.2/esp32s3/get-started/index.html)

---

## Быстрый старт

```bash
git clone -b hello https://github.com/andrewkuzmenko/holyjs-mcu-workshop.git mcu-js-holy-workshop
cd mcu-js-holy-workshop   # или как вы назвали папку

. $IDF_PATH/export.sh             # Windows: export.bat / ESP-IDF PowerShell

idf.py set-target esp32s3
idf.py build
idf.py -p PORT flash monitor
```

`PORT` — например `/dev/tty.usbmodem*` (macOS), `/dev/ttyACM0` (Linux), `COM3` (Windows).

В мониторе ожидайте строку:

```text
hello from ESP32-S3
```

(`console.log` зеркалируется в stdout через `Console::writeHandler` в `main/beshell-step.cpp` — иначе BeShell шлёт лог бинарным REPL-пакетом, и `idf.py monitor` его часто не показывает.)

Выход из monitor: `Ctrl+]`.

Если строки нет: убедитесь, что прошился и раздел `js` (`idf.py flash` целиком, не только app), затем `idf.py -p PORT monitor`.

`managed_components/`, `build/`, `sdkconfig` появятся при первой сборке (в git не коммитятся).

---

## Что в репозитории

```text
js/main.js              — скрипт на устройстве
main/beshell-step.cpp   — BeShell runtime + eval /main.js
main/idf_component.yml  — зависимость become-cool/beshell
partitions.csv          — раздел js (LittleFS)
sdkconfig.defaults      — 16MB flash, Octal PSRAM
```

---

## Теги мастер-класса

| Tag | Содержимое |
|-----|------------|
| `hello` | `console.log` |
| `stepper-tone` | одна нота A4 5 с |
| `melody` | C-dur up/down |
| `wifi-sta` | melody + Wi‑Fi STA |
| `http` | + HTTP `/health` |
| `mcp` | HTTP + MCP tools |

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
