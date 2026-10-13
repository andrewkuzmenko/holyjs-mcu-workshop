# Для участников: агент, curl, промпты

Это продолжение [README](../README.md): плата прошита тегом `mcp`, подключена к Wi‑Fi, в мониторе есть `MCP URL: http://<IP>/mcp`.

## Endpoints

- `GET http://<IP>/health` — состояние: `ok`, `mcp`, `server`, `stepper`
- `POST http://<IP>/mcp` — MCP (JSON-RPC 2.0, Streamable HTTP без SSE и сессий)

## Tools

| Tool | Назначение | Аргументы |
|------|------------|-----------|
| `list_notes` | список нот A0…C8 | — |
| `play_note` | одна нота | `note` (`A4`, `Cs5` …), `duration_ms?` |
| `play_sequence` | мелодия на устройстве | `notes[]`, `bpm?`, `default_beats?`, `gap_ms?`, `legato?` |
| `stop` | остановить | — |

Ноты — scientific pitch, диезы через `s`: `Cs4`, `Fs5`. Элемент `notes[]` — строка `'E4'` или объект `{ note, beats }` / `{ note, duration_ms }` / `{ rest: true, beats }`.

## Cursor

Settings → MCP → добавить сервер (или `mcp.json`):

```json
{
  "mcpServers": {
    "beshell-step": {
      "url": "http://<IP>/mcp"
    }
  }
}
```

После сохранения — Reload. В списке tools должны появиться четыре tool выше. Если сервер красный: проверить `curl /health`, что ноутбук в той же Wi‑Fi, затем Reload.

## Готовые промпты

Одна нота:

```text
Call play_note with note A4 and duration_ms 500.
```

Гамма:

```text
Using the beshell-step MCP tools, play a C major scale: C4 D4 E4 F4 G4 A4 B4 C5.
Use play_sequence with bpm 100, one beat per note, legato true.
```

Мелодия и стоп:

```text
Play this melody with play_sequence at bpm 120:
E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4.
Use default_beats 1, legato true. When finished, call stop.
```

Из MIDI-файла (положите `.mid` рядом и укажите путь):

```text
Разбери MIDI-файл ./song.mid: возьми дорожку с мелодией, переведи ноты в формат A4/Cs5,
сохрани длительности и паузы, и сыграй через play_sequence. Не потеряй темп.
```

## curl

```bash
export BOARD_IP=192.168.1.42   # ваш IP из монитора

curl -s "http://$BOARD_IP/health"

curl -s "http://$BOARD_IP/mcp" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1.0"}}}'

curl -s "http://$BOARD_IP/mcp" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

curl -s "http://$BOARD_IP/mcp" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"play_note","arguments":{"note":"A4","duration_ms":500}}}'

curl -s "http://$BOARD_IP/mcp" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"play_sequence","arguments":{"notes":["C4","D4","E4","F4","G4","A4","B4","C5"],"bpm":100,"default_beats":1,"legato":true}}}'

curl -s "http://$BOARD_IP/mcp" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"stop","arguments":{}}}'
```

## Что почитать

- BeShell: <https://github.com/become-cool/beshell>
- MCP, Streamable HTTP: <https://modelcontextprotocol.io/specification/2025-03-26/basic/transports>
- ESP-IDF 5.5: <https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/>
