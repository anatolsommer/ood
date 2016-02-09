/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,console,setTimeout,clearTimeout,gc */
/* jshint strict:global, -W002 */

'use strict';

var cluster=require('cluster'), path, usage, util, log,
  cnt=0, workers=[], config={}, state, appName;

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
  state={startTime:Date.now(), usage:{}, state:'idle', errors:0};
  log=util.parentLogger;
  log.debug('Container ready');
  cluster.setupMaster({silent:true});

  process.on('message', function(msg) {
    var i;

    if (msg.cmd==='start') {
      appName=msg.appName;
      config=msg.config;
      config.killTimeout=config.killTimeout || 2500;
      config.instances=config.instances || 2;
      config.env=config.env || {};
      config.env.load_script=config.script;
      config.env.PORT=config.port;
      process.title='ood: '+appName+' - Master';
      if (!process.env.OOD_TEST) {
        util.setGid(config.gid);
        process.setuid(config.uid || 'nobody');
      }
      state.state='starting';
      log.info('Starting...');
      appLog('DEBUG', 'Starting...');
      for (i=0; i<config.instances; i++) {
        forkWorker();
      }
      setTimeout(checkState, 1800);
      getUsage();

    } else if (msg.cmd==='stop') {
      if (state.state==='stopping') {
        return;
      }
      log.info('Stopping...');
      appLog('DEBUG', 'Stopping...');
      state.state='stopping';
      workers.forEach(killWorker);
      clearTimeout(state.timeout);
      setTimeout(function() {
        process.exit();
      }, config.killTimeout+200);

    } else if (msg.cmd==='restart') {
      if (state.restarting) {
        return;
      }
      log.info('Restarting...');
      appLog('DEBUG', 'Restarting...');
      state.restarting=true;
      if (state.state==='fatal') {
        state.state='starting';
        state.errors=0;
        clearTimeout(state.timeout);
        setTimeout(checkState, 500);
      }
      for (i=0; i<config.instances; i++) {
        restartWorker(i*900);
      }
      setTimeout(function() {
        if (state.state==='running') {
          log.info('Restart was successful!');
        }
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
            state:state.state,
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
      appLog('DEBUG', 'Worker killed', worker.id, worker.process.pid);
      return;
    }
    ++state.errors;
    state.lastError=Date.now();
    appLog('DEBUG', 'Worker died', worker.id, worker.process.pid);
    log.error('Worker died', {
      workerId:worker.id,
      pid:worker.process.pid,
      code:code
    });
    if (~workers.indexOf(worker)) {
      workers.splice(workers.indexOf(worker), 1);
      if (state.state==='running') {
        forkWorker();
      }
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
      if (workers.length>config.instances) {
        killWorker(workers.shift());
      }
    }, config.instances>2 ? 500 : 1500);
  }, delay);
}

function forkWorker() {
  var worker=cluster.fork(config.env);
  log.debug('Forking worker', {workerId:worker.id, pid:worker.process.pid});
  appLog('DEBUG', 'Forking worker', worker.id, worker.process.pid);
  workers.push(worker);
  worker.send({cmd:'setTitle', title:appName});
  worker.status={startTime:Date.now(), usage:{cpu:null, ram:null}};
  worker.process.stdout.on('data', function(data) {
    appLog('INFO', data, worker.id, worker.process.pid);
  });
  worker.process.stderr.on('data', function(data) {
    appLog('ERROR', data, worker.id, worker.process.pid);
  });
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

function appLog(level, msg, workerId, pid) {
  process.send({
    type:'applog',
    level:level,
    args:[msg.toString(), {workerId:workerId, pid:pid}]
  });
}

function killWorker(worker) {
  log.debug('Killing worker', {workerId:worker.id, pid:worker.process.pid});
  worker.kill();
  worker.removeAllListeners();
  setTimeout(function() {
    worker.kill('SIGKILL');
  }, config.killTimeout);
}

function checkState() {
  var i;

  if (state.errors && Date.now()-state.lastError>60000) {
    state.errors=0;
  }

  if (state.state==='starting') {
    if (state.errors>=config.instances) {
      state.state='fatal';
      log.error('Failed to start app, check app logs!');
    } else if (state.errors) {
       if (workers.length<config.instances) {
         log.debug(state.errors+' workers failed to start, retrying');
         for (i=0; i<state.errors; i++) {
          forkWorker();
        }
      } else {
        state.errors=0;
        return checkState();
      }
    } else {
      log.info('App successfully started!');
      state.state='running';
    }
  } else if (state.state==='running') {
    if (state.errors>=config.instances) {
      state.state='fatal';
      log.error('App crashed, check app logs!');
    }
  } else if (state.state==='fatal') {
    if (workers.length<config.instances && ++cnt===5) {
      cnt=0;
      log.debug('Trying to resurrect app...');
      forkWorker();
    } else if (workers.length===config.instances) {
      log.info('App successfully resurrected!');
      state.state='running';
      state.errors=0;
    }
  }
  if (workers.length>config.instances) {
    killWorker(workers.shift());
  }
  state.timeout=setTimeout(checkState, 1000);
}

function getUsage() {
  if (state.state!=='starting') {
    gc();
  }
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
  setTimeout(getUsage, (state.state==='starting' ? 800 : 3000));
}

function initWorker() {
  process.on('message', function(msg) {
    if (msg.cmd==='setTitle') {
      process.title='ood: '+msg.title+' - Worker #'+cluster.worker.id;
    }
  });
}
