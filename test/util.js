var assert=require('assert'), util;

describe('util', function() {

  it('should require util', function() {
    util=require(__dirname+'/../lib/util.js');
  });

  describe('logger', function() {

    it('should export logger', function() {
      assert(util.logger);
    });

    it('should return logger', function() {
      assert(util.logger('test'));
    });

  });

  describe('parentLogger', function() {

    it('should export parentLogger', function() {
      assert(util.parentLogger);
    });

    it('should have error, info and debug', function() {
      assert(util.parentLogger.error);
      assert(util.parentLogger.info);
      assert(util.parentLogger.debug);
    });

  });

  describe('logReader', function() {
    var logReader;

    it('should export logReader', function() {
      assert(util.logger);
    });

    it('should return logReader and read file', function() {
      logReader=util.logReader(__filename, function(l) {
        assert.equal(l.type, 'INFO');
        if (l.msg==='TEST2') {
          done();
        }
      });
    });

    it('should return logReader and read a line', function() {
      logReader=util.logReader(__filename, {lines:1}, function(l) {
        assert.equal(l.type, 'INFO');
        assert.equal(l.msg, 'TEST1');
        done();
      });
    });

  });

  describe('setGid', function() {

    it('should export setGid', function() {
      assert(util.setGid);
    });

    if (process.getuid()!==0) {
      it('should throw an EPERM exception', function() {
        assert.throws(function() {
          util.setGid('exterminate');
        }, 'EPERM');
        assert.throws(function() {
          util.setGid();
        }, 'EPERM');
      });
    }
  });

});
