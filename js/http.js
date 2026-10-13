import * as mg from 'mg'

const JSON_HEADERS =
  'Content-Type: application/json\r\n' +
  'Access-Control-Allow-Origin: *\r\n'

/**
 * Single exit to `rspn.reply`. beshell-mg passes the body to
 * `mg_http_reply()` as a printf format string, so a bare `%` in the body
 * would read garbage varargs or crash. Escape it.
 */
function send(rspn, body, code, headers) {
  rspn.reply(String(body).replace(/%/g, '%%'), code, headers)
}

/**
 * Thin HTTP layer for the http tag: GET / and /health only.
 * MCP (/mcp) arrives on a later tag.
 *
 * @param {number} [port=80]
 * @param {() => object} getHealth
 */
export function startHttp(port, getHealth) {
  port = port || 80

  mg.listenHttp('0.0.0.0:' + port, (event, req, rspn) => {
    if (event !== 'http.msg') {
      return
    }

    try {
      const uri = req.uri()
      if (uri === '/' || uri === '/health') {
        const body = typeof getHealth === 'function' ? getHealth() : { ok: true }
        send(rspn, JSON.stringify(body), 200, JSON_HEADERS)
        return
      }

      send(rspn, 'Not Found', 404, 'Content-Type: text/plain\r\n')
    } catch (e) {
      console.log('HTTP error:', e)
      try {
        send(
          rspn,
          JSON.stringify({ ok: false, error: String(e) }),
          500,
          JSON_HEADERS,
        )
      } catch (_) {
        /* ignore secondary reply failures */
      }
    }
  })

  console.log('HTTP listening on 0.0.0.0:' + port + ' (/health)')
}
