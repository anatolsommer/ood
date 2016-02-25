var assert=require('assert'), fork=require('child_process').fork;

describe('brain', function() {
  var ood, api, config;

  this.timeout(2000);
  this._slow=1800;

  it('should start ood', function(done) {
    ood=fork(
      __dirname+'/../node_modules/istanbul/lib/cli.js',
      [
        'cover',
        __dirname+'/../lib/brain.js',
        '--dir',
        __dirname+'/../coverage/brain'
      ],
      {env:{OOD_TEST:true, OOD_DIR:__dirname+'/etc_ood'}, silent:true}
    );
    assert(ood);
    setTimeout(done, 700);
  });

  it('should require api client', function() {
    api=require('../lib/api-client.js');
  });

  it('should load config and set port', function() {
    config=require('./etc_ood/config.json');
    api.port=config.oodPort;
  });

  it('request should fail with wrong secret', function(done) {
    setTimeout(function() {
      api.secret='wrong';
      api.status(function(err) {
        assert(err);
        assert.equal(err.message, 'Denied');
        done();
      });
    }, 800);
  });

  it('should request status', function(done) {
    api.secret=config.secret;
    api.status(function(err, list) {
      if (err) {
        throw err;
      }
      assert(list);
      assert(list.proxy.master);
      done();
    });
  });

  it('should stop ood', function(done) {
    ood.kill('SIGTERM');
    ood.on('exit', done);
  });

  afterEach(function(done) {
    setTimeout(done, 150);
  });

});
