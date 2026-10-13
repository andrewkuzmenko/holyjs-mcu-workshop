import * as mg from 'mg'

export const JSON_HEADERS =
  'Content-Type: application/json\r\n' +
  'Access-Control-Allow-Origin: *\r\n' +
  'Access-Control-Allow-Headers: Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version\r\n' +
  'Access-Control-Expose-Headers: Mcp-Session-Id, MCP-Protocol-Version\r\n'

export const CORS_HEADERS =
  'Access-Control-Allow-Origin: *\r\n' +
  'Access-Control-Allow-Methods: POST, OPTIONS\r\n' +
  'Access-Control-Allow-Headers: Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version\r\n' +
  'Access-Control-Max-Age: 86400\r\n'

/**
 * Thin HTTP router over BeShell `mg.listenHttp`.
 * One instance owns the listen socket; handlers share (req, rspn).
 */
export class HttpServer {
  /**
   * @param {number} [port=80]
   */
  constructor(port) {
    this._port = port == null ? 80 : port
    /** @type {{ methods: string[] | null, path: string, handler: Function }[]} */
    this._routes = []
    this._listening = false
  }

  /** @returns {number} */
  get port() {
    return this._port
  }

  /**
   * @param {string | string[] | null} methods  null = any method
   * @param {string} path
   * @param {(req: any, rspn: any) => void} handler
   */
  route(methods, path, handler) {
    let list = null
    if (methods != null) {
      list = Array.isArray(methods) ? methods : [methods]
    }
    this._routes.push({ methods: list, path: path, handler: handler })
    return this
  }

  get(path, handler) {
    return this.route('GET', path, handler)
  }

  post(path, handler) {
    return this.route('POST', path, handler)
  }

  options(path, handler) {
    return this.route('OPTIONS', path, handler)
  }

  /** Match path regardless of method (handler decides). */
  any(path, handler) {
    return this.route(null, path, handler)
  }

  listen() {
    if (this._listening) {
      throw new Error('HttpServer already listening')
    }
    const self = this
    mg.listenHttp('0.0.0.0:' + this._port, (event, req, rspn) => {
      if (event !== 'http.msg') {
        return
      }
      self._dispatch(req, rspn)
    })
    this._listening = true
    console.log('HTTP listening on 0.0.0.0:' + this._port)
    return this
  }

  _dispatch(req, rspn) {
    const method = req.method()
    const uri = req.uri()

    for (let i = 0; i < this._routes.length; i++) {
      const r = this._routes[i]
      if (r.path !== uri) {
        continue
      }
      if (r.methods && r.methods.indexOf(method) < 0) {
        continue
      }
      try {
        r.handler(req, rspn)
      } catch (e) {
        console.log('HTTP handler error:', e)
        try {
          HttpServer.replyJson(rspn, 500, { ok: false, error: String(e) })
        } catch (_) {
          /* ignore */
        }
      }
      return
    }

    HttpServer.replyText(rspn, 404, 'Not Found')
  }

  /**
   * Single exit to `rspn.reply`. beshell-mg passes the body to
   * `mg_http_reply()` as a printf format string, so a bare `%` in the body
   * (e.g. an agent-supplied note name echoed in an error) would read garbage
   * varargs or crash. Escape it.
   */
  static _send(rspn, body, code, headers) {
    rspn.reply(String(body).replace(/%/g, '%%'), code, headers)
  }

  static replyJson(rspn, code, obj, headers) {
    HttpServer._send(
      rspn,
      JSON.stringify(obj),
      code,
      headers != null ? headers : JSON_HEADERS,
    )
  }

  static replyEmpty(rspn, code, headers) {
    HttpServer._send(rspn, '', code, headers != null ? headers : CORS_HEADERS)
  }

  static replyText(rspn, code, text, headers) {
    HttpServer._send(
      rspn,
      text,
      code,
      headers != null ? headers : 'Content-Type: text/plain\r\n',
    )
  }

  /** @returns {string} */
  static bodyText(req) {
    const body = req.body()
    if (!body) {
      return ''
    }
    if (typeof body === 'string') {
      return body
    }
    if (body.asString) {
      return body.asString()
    }
    return ''
  }
}
