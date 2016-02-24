var assert=require('assert'), config;

describe('config', function() {

  it('should require config', function() {
    process.env.OOD_DIR=__dirname+'/etc_ood';
    config=require(__dirname+'/../lib/config.js');
    assert(config);
  });

  it('should export set and get', function() {
    assert.equal(typeof config.get, 'function');
    assert.equal(typeof config.set, 'function');
  });

  describe('default values', function() {
    var id, secret;

    it('should have generated serverID', function() {
      id=config.get('serverID');
      assert(id);
    });

    it('should have generated secret', function() {
      secret=config.get('secret');
      assert(secret);
    });

    it('serverID and secret should have correct format', function() {
      assert(id.match(/^\w{11}$/));
      assert(secret.match(/^\w{32}$/));
    });

    it('logLevel should be INFO', function() {
      assert.equal(config.get('logLevel'), 'INFO');
    });

    it('should set new ports', function() {
      config.set('oodPort', 1111);
      config.set('httpPort', 1080);
      config.set('httpsPort', 1443);
      config.set('startPort', 1100);
    });

    it('should have saved values to config.json', function(done) {
      config.save(function() {
        var json=require(__dirname+'/etc_ood/config.json');
        assert.equal(json.serverID, id);
        assert.equal(json.secret, secret);
        assert.equal(json.oodPort, 1111);
        assert.equal(json.httpPort, 1080);
        assert.equal(json.httpsPort, 1443);
        assert.equal(json.startPort, 1100);
        done();
      });
    });

  });

});
