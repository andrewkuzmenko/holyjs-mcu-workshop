import { HttpServer, CORS_HEADERS, JSON_HEADERS } from '/http.js'

const PROTOCOL_VERSION = '2025-03-26'

/**
 * Streamable HTTP MCP endpoint (JSON-RPC 2.0 over POST /mcp).
 * Protocol + HTTP adapter only — tools live in ToolRegistry.
 */
export class McpServer {
  /**
   * @param {object} options
   * @param {{ name: string, version: string }} options.serverInfo
   * @param {import('/tools.js').ToolRegistry} options.tools
   * @param {string} [options.protocolVersion]
   * @param {() => object} [options.getStatus]  extra fields for /health (e.g. stepper)
   */
  constructor(options) {
    if (!options || !options.tools) {
      throw new Error('McpServer requires tools')
    }
    this.serverInfo = options.serverInfo || {
      name: 'beshell-step',
      version: '0.1.0',
    }
    this._tools = options.tools
    this.protocolVersion = options.protocolVersion || PROTOCOL_VERSION
    this._getStatus = options.getStatus || null
  }

  /** Payload fragment for GET /health. */
  health() {
    const body = {
      ok: true,
      mcp: '/mcp',
      server: this.serverInfo,
    }
    if (this._getStatus) {
      const extra = this._getStatus()
      if (extra && typeof extra === 'object') {
        for (const key in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, key)) {
            body[key] = extra[key]
          }
        }
      }
    }
    return body
  }

  /**
   * Register /health and /mcp on an HttpServer.
   * @param {HttpServer} http
   */
  mount(http) {
    const self = this
    http.get('/', (req, rspn) => {
      HttpServer.replyJson(rspn, 200, self.health())
    })
    http.get('/health', (req, rspn) => {
      HttpServer.replyJson(rspn, 200, self.health())
    })
    http.any('/mcp', (req, rspn) => {
      self._onHttp(req, rspn)
    })
    return this
  }

  _onHttp(req, rspn) {
    const method = req.method()

    if (method === 'OPTIONS') {
      HttpServer.replyEmpty(rspn, 204, CORS_HEADERS)
      return
    }

    if (method === 'GET' || method === 'DELETE') {
      HttpServer.replyText(
        rspn,
        405,
        'Method Not Allowed',
        'Allow: POST, OPTIONS\r\n' + CORS_HEADERS,
      )
      return
    }

    if (method !== 'POST') {
      HttpServer.replyText(
        rspn,
        405,
        'Method Not Allowed',
        'Allow: POST, OPTIONS\r\n' + CORS_HEADERS,
      )
      return
    }

    let parsed
    try {
      parsed = JSON.parse(HttpServer.bodyText(req))
    } catch (e) {
      HttpServer.replyJson(
        rspn,
        400,
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        },
        JSON_HEADERS,
      )
      return
    }

    if (Array.isArray(parsed)) {
      this._replyBatch(rspn, parsed)
      return
    }

    const result = this._handleMessage(parsed)
    if (result && result.notification) {
      HttpServer.replyEmpty(rspn, 202, CORS_HEADERS)
      return
    }
    HttpServer.replyJson(rspn, 200, result, JSON_HEADERS)
  }

  _replyBatch(rspn, messages) {
    const out = []
    let onlyNotifications = true
    for (let i = 0; i < messages.length; i++) {
      const r = this._handleMessage(messages[i])
      if (r && r.notification) {
        continue
      }
      onlyNotifications = false
      out.push(r)
    }
    if (onlyNotifications) {
      HttpServer.replyEmpty(rspn, 202, CORS_HEADERS)
      return
    }
    HttpServer.replyJson(rspn, 200, out, JSON_HEADERS)
  }

  _handleMessage(msg) {
    if (!msg || typeof msg !== 'object') {
      return {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }
    }

    const isNotification =
      !('id' in msg) || msg.id === undefined || msg.id === null
    const method = msg.method

    if (!method) {
      if (isNotification) {
        return { notification: true }
      }
      return {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32600, message: 'Invalid Request' },
      }
    }

    if (
      method === 'notifications/initialized' ||
      method.indexOf('notifications/') === 0
    ) {
      return { notification: true }
    }

    if (isNotification) {
      return { notification: true }
    }

    try {
      let result
      if (method === 'initialize') {
        result = this._initialize(msg.params)
      } else if (method === 'ping') {
        result = {}
      } else if (method === 'tools/list') {
        result = { tools: this._tools.listSchemas() }
      } else if (method === 'tools/call') {
        const params = msg.params || {}
        result = this._tools.call(params.name, params.arguments)
      } else {
        return {
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32601, message: 'Method not found: ' + method },
        }
      }
      return { jsonrpc: '2.0', id: msg.id, result: result }
    } catch (e) {
      return {
        jsonrpc: '2.0',
        id: msg.id,
        error: {
          code: -32603,
          message: e && e.message ? e.message : String(e),
        },
      }
    }
  }

  _initialize(params) {
    const requested = params && params.protocolVersion
    return {
      protocolVersion: requested || this.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: this.serverInfo,
    }
  }
}
