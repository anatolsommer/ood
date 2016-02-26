var assert=require('assert'), fs=require('fs'), fork=require('child_process').fork,
  Gelth=require('gelth');

describe('brain', function() {
  var ood, api, config, log;

  this.timeout(5000);
  this._slow=3000;

  before(function() {
    fs.writeFileSync(__dirname+'/log/ood.log', '');
  });

  afterEach(function() {
    api.onError=onError;
  });

  it('should require api client', function() {
    api=require('../lib/api-client.js');
  });

  it('should load config and set port', function() {
    config=require('./etc_ood/config.json');
    api.port=config.oodPort;
  });

  it('request should return ECONNREFUSED', function(done) {
    api.onError=null;
    api.secret='123';
    api.status(function(err) {
      assert(err);
      assert.equal(err.code, 'ECONNREFUSED');
      done();
    });
  });

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
    setTimeout(done, 900);
  });

  it('should start a logReader', function() {
    log=new Gelth(
      __dirname+'/log/ood.log',
      {lines:5, follow:true}
    ).on('data', function(line) {
      var err;
      try {
        line=JSON.parse(line);
      } catch(err) {
        return;
      }
      if (line.type==='ERROR') {
        err=new Error(line.msg);
        err.stack=line.stack;
        throw err;
      }
    });
  });

  it('api-server should be listening', function(done) {
    waitForLog('ood-api-server', 'Listening on port 1111', done);
  });

  it('request should fail with wrong secret', function(done) {
    api.onError=null;
    api.secret='wrong';
    api.status(function(err) {
      assert(err);
      assert.equal(err.message, 'Denied');
      done();
    });
    api.secret=config.secret;
  });

  it('should request status', function(done) {
    api.status(function(err, list) {
      if (err) {
        throw err;
      }
      assert(list);
      assert(list.proxy.master);
      done();
    });
  });

  describe('config', function() {

    it('should set config value', function(done) {
      api.config.set('foo', 'bar', done);
    });

    it('should get config value', function(done) {
      api.config.get('foo', function(err, val) {
        assert.equal(val, 'bar');
        done();
      });
    });

    it('should delete config value', function(done) {
      api.config.delete('foo', function(err) {
        api.config.get('foo', function(err, val) {
          assert.equal(val, null);
          done();
        });
      });
    });

  });

  describe('init', function() {

    it('init should return error if no cwd was specified', function(done) {
      api.onError=null;
      api.init('test', {}, function(err) {
        assert(err);
        assert.equal(err.message, 'No "cwd" specified!');
        done();
      });
    });

    it('init should return error on duplicate app name', function(done) {
      api.onError=null;
      api.init('proxy', {cwd:'/'}, function(err) {
        assert(err);
        assert.equal(err.message, 'App already exists');
        done();
      });
    });

    it('should initialise an app', function(done) {
      waitForLog('ood-brain', 'Initialised new app', done);
      api.init('app1', {cwd:__dirname+'/apps', script:'app1.js'});
    });

  });

  describe('apps', function() {

    it('should start the app', function(done) {
      waitForLog('app1', 'App successfully started!', done);
      api.start('app1');
    });

    it('should restart the app', function(done) {
      waitForLog('app1', 'Restart was successful!', done);
      api.restart('app1');
    });

    it('should scale the app', function(done) {
      waitForLog('app1', 'Scaling from 2 to 3', done);
      api.scale('app1', 3);
    });

    it('should stop the app', function(done) {
      waitForLog('app1', 'Stopping...', done);
      api.stop('app1');
    });

    it('should delete the app', function(done) {
      api.config.delete('app:app1', done);
    });

    it('should initialise a second app with 3 instances', function(done) {
      api.init('app2', {
        cwd:__dirname+'/apps',
        script:'app1.js',
        instances:3,
        killTimeout:1000
      });
      waitForLog('ood-brain', 'Initialised new app', function() {
        api.config.get('app2', 'instances', function(err, val) {
          assert.equal(val, 3);
          done();
        });
      });
    });

    it('should start the second app', function(done) {
      waitForLog('app2', 'App successfully started!', done);
      api.start('app2');
    });

    it('should stop and delete the app', function(done) {
      waitForLog('app2', 'Stopping...', done);
      api.config.delete('app:app2');
    });

  });

  describe('redirects', function() {

    it('should set a http redirect', function(done) {
      api.redirect('http://www.example.com', 'https://example.com', function() {
        api.config.get('redirect:www.example.com', function(err, val) {
          assert.equal(typeof val, 'object');
          assert.equal(val.target, 'https://example.com');
          assert.equal(val.protocol, 'http');
          done();
        });
      });
    });

    it('should set a general redirect', function(done) {
      api.redirect('www.example.org', 'https://example.com', function() {
        api.config.get('redirect:www.example.org', function(err, val) {
          assert.equal(typeof val, 'object');
          assert.equal(val.target, 'https://example.com');
          assert.equal(val.protocol, null);
          done();
        });
      });
    });

    it('should add http if no protocol present', function(done) {
      api.redirect('example.org', 'example.com', function() {
        api.config.get('redirect:example.org', function(err, val) {
          assert.equal(typeof val, 'object');
          assert.equal(val.target, 'http://example.com');
          assert.equal(val.protocol, null);
          done();
        });
      });
    });

    it('should return error if url is invalid', function(done) {
      api.onError=null;
      api.redirect('', 'x', function(err) {
        assert(err);
        assert.equal(err.message, 'Invalid URL!');
        done();
      });
    });

    it('should delete a redirect', function(done) {
      api.redirect('example.org', false, function() {
        api.config.get('redirect:example.org', function(err, val) {
          assert.equal(val, null);
          done();
        });
      });
    });

  });

  describe('SIGTERM', function() {

    it('should stop ood', function(done) {
      ood.kill('SIGTERM');
      ood.on('exit', done);
    });

  });

  function waitForLog(app, msg, cb) {
    log.once('data', function(line) {
      try {
        line=JSON.parse(line);
      } catch(err) {
        return waitForLog(app, msg, cb);
      }
      if (line.app===app && line.msg===msg) {
        cb();
      } else {
        waitForLog(app, msg, cb);
      }
    });
  }

  function onError(err) {
    throw err;
  }

});
