/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,console,setTimeout,gc */
/* jshint strict:global, -W002 */

'use strict';

var cluster=require('cluster'), path, usage, util, log,
  workers=[], config={}, state, appName;

if (cluster.isMaster) {
  usage=require('pidusage');
  util=require('./util');
  initMaster();
} else {
  path=require('path');
  initWorker();
  require(path.resolve(process.env.load_script));
}

function initMaster() {
  state={startTime:Date.now(), usage:{cpu:null, ram:null}};
  log=util.parentLogger;

  process.on('message', function(msg) {
    var i;

    if (msg.cmd==='start') {
      appName=msg.appName;
      config=msg.config;
      config.killTimeout=config.killTimeout || 2500;
      config.instances=config.instances || 2;
      process.title='ood: '+appName+' - Master';
      util.setGid(config.gid);
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
            startTime:state.startTime,
            usage:state.usage
          },
          workers:workers.map(function(worker) {
            return {
              workerId:worker.id,
              pid:worker.process.pid,
              state:worker.state,
              startTime:worker.status.startTime,
              usage:worker.status.usage
            };
          })
        }
      });

    } else if (msg.cmd==='broadcast' || msg.cmd==='unicast') {
      workers.forEach(function(worker) {
        var isTarget=(msg.workerId===worker.id || msg.pid===worker.process.pid);
        if (msg.cmd==='broadcast' || isTarget) {
          worker.send(msg.msg);
        }
      });

    }
  });

  cluster.on('exit', function(worker, code) {
    usage.unmonitor(worker.process.pid);
    worker.removeAllListeners();
    if (worker.suicide) {
      return;
    }
    log.error('Worker died', {
      workerId:worker.id,
      pid:worker.process.pid,
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

  getUsage();
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
  log.debug('Forking worker', {workerId:worker.id, pid:worker.process.pid});
  workers.push(worker);
  worker.send({cmd:'setTitle', title:appName});
  worker.status={startTime:Date.now(), usage:{cpu:null, ram:null}};
  worker.on('message', function(msg) {
    if (msg.type==='log') {
      msg.args[1]=msg.args[1] || {};
      msg.args[1].workerId=worker.id;
      msg.args[1].pid=worker.process.pid;
      log.log(msg.level, msg.args);
    }
  });
  process.send({type:'workerStarted', workerId:worker.id, pid:worker.process.pid});
}

function killWorker(worker) {
  log.debug('Killing worker', {workerId:worker.id, pid:worker.process.pid});
  worker.kill();
  worker.removeAllListeners();
  setTimeout(function() {
    worker.kill('SIGKILL');
  }, config.killTimeout);
}

function getUsage() {
  gc();
  usage.stat(process.pid, function(err, res) {
    state.usage.cpu=res.cpu;
    state.usage.ram=res.memory;
  });
  workers.forEach(function(worker) {
    usage.stat(worker.process.pid, function(err, res) {
      worker.status.usage.cpu=(err ? -1 : res.cpu);
      worker.status.usage.ram=(err ? -1 : res.memory);
    });
  });
  setTimeout(getUsage, 3000);
}

function initWorker() {
  process.on('message', function(msg) {
    if (msg.cmd==='setTitle') {
      process.title='ood: '+msg.title+' - Worker #'+cluster.worker.id;
    }
  });
}
