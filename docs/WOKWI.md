# Без платы: уровень `hello` в Wokwi

Если ESP32-S3 нет, первый уровень можно повторить в браузере. Мотор, Wi‑Fi и MCP в эмуляторе не запускаем.

## Что нужно

- Браузер и бесплатный аккаунт <https://wokwi.com>
- Проект: <https://wokwi.com/projects/477542272145539073>
- Файл [`emulator/hello.uf2`](emulator/hello.uf2) — готовая прошивка тега `hello`, лежит в этом репозитории

## Шаги

1. Открыть [проект](https://wokwi.com/projects/477542272145539073). Либо создать свой: **New project → ESP32-S3 (ESP-IDF)** и заменить `diagram.json` на [emulator/diagram.json](emulator/diagram.json) — там плата **ESP32-S3-DevKitC-1** с 16 MB flash и 8 MB Octal PSRAM, как у настоящей.
2. `F1` (или `Ctrl/Cmd+Shift+P`) → **Upload Firmware and Start Simulation…** → выбрать `hello.uf2`.
3. В Serial Monitor снизу: `hello from ESP32-S3`.

Зелёный **Start** у скетча не нажимать — он запустит облачную сборку, на бесплатном тарифе это долго.

## Если собираете UF2 сами

```bash
git checkout hello
idf.py set-target esp32s3 && idf.py build
idf.py uf2            # build/uf2.bin → переименовать в hello.uf2
```
