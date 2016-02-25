var assert=require('assert'), fork=require('child_process').fork;

describe('appContainer', function() {
  var cont, cnt=0;

  this.timeout(15000);
  this._slow=9999;

  it('should fork an appContainer', forkContainer);

  it('should start an app', function(done) {
    cont.send({
      cmd:'start',
      config:{script:__dirname+'/apps/test1.js', cwd:__dirname+'/apps'}
    });
    wait4msg('workerStarted', function(msg) {
      assert(msg.workerId);
      assert(msg.pid);
      wait4msg('workerStarted', function(msg) {
        assert(msg.workerId);
        assert(msg.pid);
        done();
      });
    });
  });

  it('should scale from 2 to 4', function(done) {
    cont.send({cmd:'scale', instances:4});
    wait4msg('log', function(msg) {
      assert.equal(msg.args[0], 'Scaling from 2 to 4');
      wait4msg('workerStarted', function(msg) {
        assert(msg.workerId);
        assert(msg.pid);
        done();
      });
    });
  });

  it('should scale from 4 to 2', function(done) {
    cont.send({cmd:'scale', instances:2});
    wait4msg('log', function(msg) {
      assert.equal(msg.args[0], 'Scaling from 4 to 2');
      wait4msg('log', function(msg) {
        assert.equal(msg.args[0], 'Killing worker');
        wait4msg('log', function(msg) {
          assert.equal(msg.args[0], 'Killing worker');
          done();
        });
      });
    });
  });

  it('should restart an app', function(done) {
    cont.send({cmd:'restart'});
    cont.send({cmd:'restart'});
    wait4log('Restarting...', function() {
      wait4log('Restart was successful!', function() {
        done();
      });
    });
  });

  it('should restart crashed worker', function(done) {
    cont.send({cmd:'unicast', workerId:6, msg:'crash'});
    wait4log('Worker died', function() {
      wait4log('Forking worker', function() {
        wait4msg('workerStarted', function(msg) {
          assert(msg.workerId);
          assert(msg.pid);
          done();
        });
      });
    });
  });

  it('should stop an app', function(done) {
    cont.send({cmd:'stop'});
    cont.on('exit', function() {
      done();
    });
  });

  it('should fork a new appContainer', forkContainer);

  it('should try to start a crashing app', function(done) {
    cont.send({
      cmd:'start',
      config:{
        script:__dirname+'/apps/test1.js',
        cwd:__dirname+'/apps',
        env:{crash:Date.now()+10000}
      }
    });
    wait4msg('workerStarted', function(msg) {
      assert(msg.workerId);
      assert(msg.pid);
      wait4msg('workerStarted', function(msg) {
        assert(msg.workerId);
        assert(msg.pid);
        setTimeout(done, 1500);
      });
    });
  });

  it('state should be "fatal"', function(done) {
    cont.send({cmd:'status'});
    wait4msg('status', function(msg) {
      assert.equal(msg.status.master.state, 'fatal');
      setTimeout(done, 1000);
    });
  });

  it('should try to resurrect app', function(done) {
    wait4log('Trying to resurrect app...', function() {
      setTimeout(done, 1000);
    });
  });

  it('should resurrect app', function(done) {
    wait4log('App successfully resurrected!', function() {
      done();
    });
  });

  it('state should be "running"', function(done) {
    cont.send({cmd:'status'});
    wait4msg('status', function(msg) {
      assert.equal(msg.status.master.state, 'running');
      done();
    });
  });

  it('should stop the second app', function(done) {
    cont.send({cmd:'stop'});
    cont.send({cmd:'stop'});
    cont.on('exit', function() {
      done();
    });
  });

  afterEach(function(done) {
    setTimeout(done, 1000);
  });

  function forkContainer(done) {
    cont=fork(
      __dirname+'/../node_modules/istanbul/lib/cli.js',
      [
        'cover',
        __dirname+'/../lib/appContainer.js',
        '--dir',
        __dirname+'/../coverage/appContainer'+(++cnt)
      ],
      {env:{OOD_TEST:true}, execArgv:['--expose-gc'], silent:true}
    );
    wait4msg('log', function(msg) {
      cont.send({cmd:'status'});
      wait4msg('status', function(msg) {
        assert(msg.status.master);
        assert.equal(msg.status.workers.length, 0);
        done();
      });
    });
  }

  function wait4log(txt, cb) {
    wait4msg('log', function(msg) {
      if (msg.args[0]===txt) {
        cb(msg);
      } else {
        wait4log(txt, cb);
      }
    });
  }

  function wait4msg(type, cb) {
    cont.once('message', function(msg) {
      if (msg.type===type) {
        cb(msg);
      } else {
        wait4msg(type, cb);
      }
    });
  }

});
