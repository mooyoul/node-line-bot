/**
 * Module dependencies.
 */
const
  { expect }  = require('chai'),
  Promise     = require('bluebird'),
  fs          = require('fs'),
  path        = require('path'),
  request     = require('request'),
  LineBot     = require('../src/line');


describe('LineBot module', () => {
  it('should exports `LineBot` class constructor', () => {
    expect(LineBot).to.be.a('function');
  });
});


describe('LineBot class', () => {
  describe('constructor', () => {
    it('should create `LineBot` instance', () => {
      expect(new LineBot()).instanceOf(LineBot);
    });

    it('should set `token` property', () => {
      const
        token = 'foo',
        bot   = new LineBot(token);

      expect(bot.token).equal(token);
    });

    it('should set `options` property to empty hash object', () => {
      const
        bot = new LineBot('foo');

      expect(bot.options).to.be.a('object');
      expect(Object.keys(bot.options)).to.have.lengthOf(0);
    });

    it('should set `options` property', () => {
      const
        options = {
          wow: 'such option'
        },
        bot = new LineBot('foo', options);


      // note that `options` hash was referenced on constructor
      expect(bot.options).equal(options);
    });

    it('should set `_matchers` property', () => {
      const
        bot = new LineBot('foo');

      expect(bot._matchers).instanceOf(Array);
      expect(bot._matchers).to.have.lengthOf(0);
    });
  });

  describe('#listen', () => {
    const
      bot = new LineBot('foo'),
      options = {
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
        key: fs.readFileSync(path.join(__dirname, 'key.pem'))
      },
      _request = request.defaults({
        baseUrl: 'https://localhost:9000',
        timeout: 1000,
        agentOptions: {
          ca: options.cert
        }
      });

    let deferred = null;

    it('should have #listen method', () => {
      expect(bot.listen).to.be.a('function');
    });

    it('should return Promise', () => {
      deferred = bot.listen(options);

      expect(deferred).instanceOf(Promise);
    });

    it('should listen on 0.0.0.0:9000 on default options with HTTPS', (done) => {
      deferred.then(() => {
        done();
      }).catch((e) => {
        done(e);
      });
    });

    it('should respond with status 400 on invalid callback urls', (done) => {
      _request({
        method: 'GET',
        url: '/not-exists-path'
      }, (e, xhr, body) => {
        if (e) { return done(e); }

        expect(xhr.statusCode).equal(400);
        expect(body).equals('Bad Request');
        done();
      });
    });

    it('should respond with status 400 on invalid methods', (done) => {
      _request({
        method: 'POST',
        url: '/callback'
      }, (e, xhr, body) => {
        if (e) { return done(e); }

        expect(xhr.statusCode).equal(400);
        expect(body).equals('Bad Request');
        bot.server.close(done);
      });
    });

    it('should listen on 127.0.0.1:9001 without HTTP (enabled insecure option)', (done) => {
      bot.listen({
        port: 9001,
        host: '127.0.0.1',
        insecure: true
      }).then(done).catch(done);
    });

    it('should handle request even HTTP enabled', (done) => {
      request({
        url: 'http://127.0.0.1:9001/',
        method: 'GET'
      }, (e, xhr, body) => {
        if (e) { return done(e); }

        expect(xhr.statusCode).equal(400);
        expect(body).equals('Bad Request');
        done();
      });
    });

    it('should reject Promise when something went wrong during listening', (done) => {
      const prevServer = bot.server;

      // note that 9001 port is already listening
      bot.listen({
        port: 9001,
        host: '127.0.0.1',
        insecure: true
      }).then(() => {
        done(new Error('listen should throw an error'));
      }).catch((e) => {
        expect(e).instanceOf(Error);
        expect(e.code).equal('EADDRINUSE');
        prevServer.close(done);
      });
    });
  });

  describe('#shutdown', () => {
    const bot = new LineBot();
    let deferred = null;

    it('should have #shutdown method', () => {
      expect(bot.shutdown).to.be.a('function');
    });

    it('should resolve Promise even server wasn`t started', (done) => {
      bot.shutdown().then(done);
    });

    it('should return Promise', (done) => {
      bot.listen()
      .then(() => {
        deferred = bot.shutdown();
        expect(deferred).instanceOf(Promise);
        done();
      }).catch((e) => {
        done(e);
      });
    });

    it('should shutdown gracefully via #shutdown method', (done) => {
      deferred.then(() => {
        done();
      }).catch(done);
    });

    it('should reject Promise when something went wrong during close server', (done) => {
      bot.shutdown().then(() => {
        done(new Error('shutdown should throw an error'));
      }).catch((e) => {
        expect(e).instanceOf(Error);
        expect(e.message).equal('Not running');
        done();
      });
    });
  });
});
