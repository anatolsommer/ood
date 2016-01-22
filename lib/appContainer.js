/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,console,setTimeout */
/* jshint strict:global, -W002 */

'use strict';

var cluster=require('cluster'), path=require('path'), log=require('./util').parentLogger,
  workers=[], state={}, config={}, startTime=Date.now(), appName;

if (cluster.isMaster) {
  initMaster();
} else {
  initWorker();
  require(path.resolve(process.env.load_script));
}

function initMaster() {
  process.on('message', function(msg) {
    var i;

    if (msg.cmd==='start') {
      appName=msg.appName;
      config=msg.config;
      config.killTimeout=config.killTimeout || 2500;
      config.instances=config.instances || 2;
      process.title='ood: '+appName+' - Master';
      process.setgroups(config.gid ? [config.gid] : []);
      process.setgid(config.gid || 'nogroup');
      process.setuid(config.uid || 'nobody');
      log.info('Starting...');
      for (i=0; i<config.instances; i++) {
        forkWorker();
      }

    } else if (msg.cmd==='stop') {
      if (state.stopping) {
        return;
      }
      log.info('Stopping...');
      state.stopping=true;
      workers.forEach(killWorker);
      setTimeout(function() {
        process.exit();
      }, config.killTimeout);

    } else if (msg.cmd==='restart') {
      if (state.restarting) {
        return;
      }
      log.info('Restarting...');
      state.restarting=true;
      for (i=0; i<config.instances; i++) {
        restartWorker(i*1000);
      }
      setTimeout(function() {
        state.restarting=false;
      }, i*config.killTimeout/2);

    } else if (msg.cmd==='scale') {
      log.info('Scaling from '+config.instances+' to '+msg.instances);
      if (msg.instances>config.instances) {
        for (i=0; i<msg.instances-config.instances; i++) {
          forkWorker();
        }
      } else {
        for (i=0; i<config.instances-msg.instances; i++) {
          killWorker(workers.shift());
        }
      }
      config.instances=msg.instances;

    } else if (msg.cmd==='status') {
      log.debug('Parent requested status');
      process.send({
        type:'status',
        status:{
          master:{
            pid:process.pid,
            state:'ok',
            startTime:startTime
          },
          workers:workers.map(function(worker) {
            return {
              workerId:worker.id,
              pid:worker.process.pid,
              state:worker.state,
              startTime:worker.status.startTime
            };
          })
        }
      });

    } else if (msg.cmd==='broadcast') {
      workers.forEach(function(worker) {
        worker.send(msg.msg);
      });

    }
  });

  cluster.on('exit', function(worker, code) {
    worker.removeAllListeners();
    if (worker.suicide) {
      return;
    }
    log.error('Worker died', {
      workerId:worker.id,
      PID:worker.process.pid,
      code:code
    });
    if (~workers.indexOf(worker)) {
      workers.splice(workers.indexOf(worker), 1);
      forkWorker();
    }
  });

  process.on('uncaughtException', function(err) {
    try {
      log.error('Uncaught exception', {
        stack:err.stack
      });
    } catch(err) {
      console.error(err.stack);
    }
  });
}

function restartWorker(delay) {
  setTimeout(function() {
    forkWorker();
    setTimeout(function() {
      killWorker(workers.shift());
    }, config.instances>2 ? 500 : 1500);
  }, delay);
}

function forkWorker() {
  var worker=cluster.fork({
    load_script:config.script,
    PORT:config.port
  });
  log.debug('Forking worker', {workerId:worker.id, PID:worker.process.pid});
  workers.push(worker);
  worker.send({cmd:'setTitle', title:appName});
  worker.status={startTime:Date.now()};
  worker.on('message', function(msg) {
    if (msg.type==='log') {
      log.log(msg.level, msg.args);
    }
  });
}

function killWorker(worker) {
  log.debug('Killing worker', {workerId:worker.id, PID:worker.process.pid});
  worker.kill();
  worker.removeAllListeners();
  setTimeout(function() {
    worker.kill('SIGKILL');
  }, config.killTimeout);
}

function initWorker() {
  process.on('message', function(msg) {
    if (msg.cmd==='setTitle') {
      process.title='ood: '+msg.title+' - Worker #'+cluster.worker.id;
    }
  });
}

