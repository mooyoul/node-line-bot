/**
 * Module dependencies.
 */
const
  Promise       = require('bluebird'),
  crypto        = require('crypto'),
  http          = require('http'),
  https         = require('https'),
  EventEmitter  = require('events'),
  debug         = require('debug'),
  bl            = require('bl'),
  log           = debug('node-line-bot');


class LineBot extends EventEmitter {
  static EVENT_MESSAGE = Symbol('message');
  static EVENT_OPERATION = Symbol('operation');

  /**
   * @see https://developers.line.me/bot-api/getting-started-with-bot-api-trial#request_specifications
   */
  static EVENT_TYPES = {
    '138311609000106303': LineBot.EVENT_MESSAGE,
    '138311609100106403': LineBot.EVENT_OPERATION
  };

  /**
   * @see https://developers.line.me/bot-api/api-reference#receiving_messages_contenttype
   */
  static CONTENT_TYPES = {
    1: 'text',
    2: 'image',
    3: 'video',
    4: 'audio',
    7: 'location',
    8: 'sticker',
    10: 'contact'
  };

  static OPERATION_TYPES = {
    4: 'added_by_user',
    8: 'blocked_by_user'
  };

  /**
   * @class LineBot
   * @constructor
   * @param {String} token Bot Token
   * @param {Object} [options]
   * @see https://developers.line.me/bot-api
   */
  constructor(token, options = {}) {
    super();

    this.token = token;
    this.options = options;
    this._matchers = [];
  }

  _requestListener(req, res) {
    log('_requestListener called. request: %s %s', req.method, req.url);
    log('headers: %j', req.headers);

    log('this.options: ', this.options);

    if ((req.url !== this._callbackUrl) || (req.method !== 'POST')) {
      res.writeHead(400);
      return res.end('Bad Request');
    }

    this.handleRequest(req, res);
  }

  computeSignature(bufPayload) {
    try {
      return crypto.createHmac('sha256', this.token)
        .update(bufPayload)
        .digest('base64');
    } catch (e) {
      return null;
    }
  }

  handleRequest(req, res) {
    log('handleRequest called. piping request into buffered list');

    // Validate `X-LINE-ChannelSignature` field exists on Request Header
    const channelSignature = req.headers['x-line-channelsignature'];
    if (!channelSignature) {
      res.writeHead(400);
      return res.end('Bad Request');
    }

    req.on('end', () => {
      log('request stream was ended. sending 200 OK response...');
      res.writeHead(400);
      res.end('OK');
    }).pipe(bl((e, bufData) => {
      if (e) {
        return log(e);
      }

      log('validating signature');
      if (this.computeSignature(bufData) !== channelSignature) {
        res.writeHead(400);
        return res.end('Bad Request');
      }

      try {
        this.processUpdate(JSON.parse(bufData));
      } catch (e) {
        log(e);
      }
    }));
  }

  // @see https://developers.line.me/bot-api/api-reference#receiving_messages_property
  processUpdate(payload) {
    log('processUpdated called (payload: %j)', payload);

    if (!(payload && payload.result && payload.result.length)) {
      return;
    }

    payload.result.forEach((data) => {
      const type = LineBot.EVENT_TYPES[data.eventType];

      if (type === LineBot.EVENT_MESSAGE) {
        const message = {
          id: data.content.id,
          type: LineBot.CONTENT_TYPES[data.content.contentType],
          from: data.content.from,
          to: data.content.to,
          text: data.content.text,
          metadata: data.content.contentMetadata,
          location: data.content.location,
          createdAt: new Date(data.createdTime),
          raw: data
        };

        this.emit('message', message);
        this.emit(message.type, message);
        this._matchers.forEach((matcher) => {
          const matches = matcher.test(message.text || '');
          if (matches) {
            matcher.done(message, matches);
          }
        });
      } else if (type === LineBot.EVENT_OPERATION) {
        const operation = {
          id: data.id,
          type: LineBot.OPERATION_TYPES[data.content.opType] || 'unknown',
          from: data.content.params[0],
          revision: data.content.revision,
          createdAt: new Date(data.createdTime),
          raw: data
        };

        this.emit('operation', operation);
        this.emit(operation.type, operation);
      } else {
        log('%s is not implemented event type!', data.eventType);
      }
    });
  }

  onText(matcher, done) {
    if (typeof matcher === 'string') {
      this._matchers.push({
        test: (text) => text === matcher,
        done
      });
    } else if (matcher instanceof RegExp) {
      this._matchers.push({
        test: (text) => text.match(matcher),
        done
      });
    } else if (typeof matcher === 'function') {
      this._matchers.push({
        test: matcher,
        done
      });
    }
  }

  /**
   * @param {Object} [options]
   * @param {Number} [options.port] Port (default: 9000)
   * @param {Number} [options.host] Host (default: 0.0.0.0)
   * @param {String} [options.key] PEM private key
   * @param {String} [options.cert] PEM certificate (public key)
   * @param {String} [options.callbackUrl] Registered callback path (not url!) (default: /callback)
   */
  listen(options = {}) {
    return new Promise((resolve, reject) => {
      const
        port = options.port || 9000,
        host = options.host || '0.0.0.0';

      this._callbackUrl = options.callbackUrl || '/callback';

      if (options.insecure) {
        this.server = http.createServer((req, res) => this._requestListener(req, res));
      } else {
        this.server = https.createServer({
          key: options.key,
          cert: options.cert
        }, (req, res) => this._requestListener(req, res));
      }

      this.server.listen(port, host, () => {
        log('server listening in %s:%d', host, port);
        resolve();
      }).on('error', (e) => {
        reject(e);
      });
    });
  }

  shutdown() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return resolve();
      }

      this.server.close((e) => {
        if (e) { return reject(e); }

        resolve();
      });
    });
  }
}


module.exports = exports = LineBot;
