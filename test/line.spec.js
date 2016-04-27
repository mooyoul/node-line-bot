/**
 * Module dependencies.
 */
const
  { expect }  = require('chai'),
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
});
