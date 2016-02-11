/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,__dirname,console,setTimeout */
/* jshint strict:global */

'use strict';

var fork=require('child_process').fork,
  mkdirp=require('mkdirp'), Log=require('vinvocci'),
  apiServer=require('./api-server'), util=require('./util'),
  log=util.logger('ood-brain'), noop=function() {}, ood={};

ood.config=require('./config');
ood.logLevel=ood.config.get('logLevel') || 'DEBUG';
log.setLevel(ood.logLevel);
log.info('Starting...');

if (ood.config.get('gid')) {
  process.setgid(ood.config.get('gid'));
}

ood.appConfig=ood.config.subSelector('app');
ood.apps={
  proxy:{
    started:false,
    status:{},
    master:null,
    config:{
      script:'./proxy',
      cwd:__dirname,
      uid:'root',
      instances:ood.config.get('app:proxy:instances') || 4
    }
  }
};

ood.config.on('change', function(key, val) {
  key=key.split(':');
  if (key[0]==='logLevel' && val) {
    log.setLevel(val);
  } else if (key[0]==='gid' && val) {
    process.setgid(val);
  } else if (key[0]==='redirect' || key[key.length-1]==='alias') {
    ood.updateProxy();
  } else if (~['httpPort', 'httpsPort'].indexOf(key[0])) {
    ood.restart('proxy');
  }
});

ood.certMgr=require('./certMgr');
ood.certMgr.on('import', function(cert, ca, first) {
  if (!ood.apps.proxy.master) {
    return;
  }
  if (first) {
    ood.restart('proxy');
  } else {
    ood.apps.proxy.master.send({
      cmd:'broadcast',
      msg:{cmd:'refreshssl'}
    });
  }
});

(function autoRenewCerts() {
  setTimeout(autoRenewCerts, 43200000);
  ood.certMgr.autoRenew();
})();

ood.startApps=function() {
  log.debug('Starting apps...');
  Object.keys(ood.apps).forEach(function(appName) {
    if (appName==='proxy' && ood.config.get('disableProxy')) {
      return;
    }
    if (appName==='proxy' || ood.appConfig(appName).get('start')) {
      ood.start(appName);
    }
  });
};

ood.msg=function(appName, msg) {
  try {
    ood.apps[appName].master.send(msg);
    return true;
  } catch(err) {
    log.error('Error sending message to appContainer', {
      appName:appName,
      message:msg,
      stack:err.stack
    });
    return false;
  }
};

ood.init=function(appName, config, cb) {
  cb=(typeof cb==='function' ? cb : noop);
  if (ood.apps[appName]) {
    return cb(new Error('App already exists'));
  }
  ood.apps[appName]={
    started:false,
    status:{},
    master:null
  };
  config.script=config.script || 'app.js';
  config.port=getFreePort();
  ood.config.set('app:'+appName, config, cb);
  ood.updateProxy();
};

ood.start=function(appName, cb) {
  getApp(appName, cb, false, function(app, cb) {
    var config=ood.appConfig(appName), logFile;
    log.debug('Starting app', {appName:appName});
    config.set('start', true);
    app.started=Date.now();
    if (!app.log) {
      logFile=ood.config.get('logDir')+'/'+appName;
      app.log=new Log(Log.DEBUG, null, logFile);
    }
    app.master=fork(__dirname+'/appContainer', {
      cwd:(app.config ? app.config.cwd : config.get('cwd')),
      env:config.get('env'),
      execArgv:['--expose-gc']
    });
    app.master.send({
      cmd:'start',
      appName:appName,
      config:app.config || config.get()
    });
    app.master.on('message', function(msg) {
      if (msg.type==='log') {
        msg.args[1]=msg.args[1] || {};
        msg.args[1].app=appName;
        log.log(msg.level, msg.args);
      } else if (msg.type==='applog') {
        app.log.log(msg.level, msg.args);
      } else if (appName==='proxy' && msg.type==='workerStarted') {
        ood.updateProxy(msg.pid);
      }
    });
    app.master.on('exit', function(code) {
      app.master.removeAllListeners();
      if (!app.started) {
        return;
      }
      log.error('appContainer died', {
        appName:appName,
        pid:app.master.pid,
        code:code
      });
      app.started=false;
      app.status={};
      ood.start(appName);
    });
    cb(null, app.master.pid);
  });
};

ood.stop=function(appName, cb) {
  getApp(appName, cb, true, function(app, cb) {
    log.debug('Stopping app', {appName:appName});
    app.started=false;
    ood.appConfig(appName).set('start', false);
    cb(!ood.msg(appName, {cmd:'stop'}));
  });
};

ood.restart=function(appName, cb) {
  getApp(appName, cb, true, function(app, cb) {
    log.debug('Restarting app', {appName:appName});
    ood.appConfig(appName).set('start', true);
    cb(!ood.msg(appName, {cmd:'restart'}));
  });
};

ood.scale=function(appName, instances, cb) {
  getApp(appName, cb, true, function(app, cb) {
    log.debug('Scaling app', {appName:appName, instances:instances});
    ood.appConfig(appName).set('instances', instances);
    cb(!ood.msg(appName, {cmd:'scale', instances:instances}));
  });
};

ood.status=function(cb) {
  var status={}, cnt=0, apps=Object.keys(ood.apps).sort(appSort);
  cb=typeof cb==='function' ? cb : noop;
  apps.forEach(function(appName) {
    if (ood.apps[appName].started) {
      ood.msg(appName, {cmd:'status'});
      status[appName]=null;
      cnt++;
      waitForStatus(appName, function(appStatus) {
        status[appName]=appStatus;
        if (--cnt===0) {
          cb(status);
        }
      });
    } else {
      status[appName]='stopped';
    }
  });
};

ood.updateProxy=function(pid) {
  var config={}, hosts={app:{}, redirect:{}};
  if (!ood.apps.proxy.master) {
    return;
  }
  config.httpPort=ood.config.get('httpPort');
  config.httpsPort=ood.config.get('httpsPort');
  hosts.redirect=ood.config.get('redirect');
  Object.keys(ood.apps).forEach(function(appName) {
    var port, config;
    if (appName!=='proxy') {
      config=ood.appConfig(appName);
      port=config.get('port');
      hosts.app[appName.toLowerCase()]=port;
      if (config.get('alias')) {
        config.get('alias').split(/[,; ]+/).forEach(function(host) {
          hosts.app[host.toLowerCase()]=port;
        });
      }
    }
  });
  ood.apps.proxy.master.send({
    cmd:(pid ? 'unicast' : 'broadcast'),
    pid:pid,
    msg:{
      cmd:'update',
      config:config,
      hosts:hosts
    }
  });
};

process.on('SIGTERM', function() {
  log.info('Got SIGTERM, exiting');
  Object.keys(ood.apps).forEach(function(appName) {
    if (ood.apps[appName].started) {
      log.debug('Stopping app', {appName:appName});
      ood.msg(appName, {cmd:'stop'});
    }
  });
  setTimeout(function() {
    process.exit();
  }, 200);
});

process.on('uncaughtException', function(err) {
  console.error(JSON.stringify({
    time:new Date(),
    type:'ERROR',
    app:'ood-brain',
    msg:'Uncaught exception',
    stack:err.stack
  }));
});

Object.keys(ood.config.get('app')).forEach(function(appName) {
  if (appName==='proxy') {
    return;
  }
  ood.apps[appName]={
    started:false,
    status:{},
    master:null
  };
});

mkdirp(ood.config.get('logDir'), function(err) {
  if (err) {
    log.error('Could not create log directory', {stack:err.stack});
    return;
  }
  ood.startApps();
  apiServer.start(ood);
});

function getApp(appName, errCb, running, cb) {
  var app=ood.apps[appName];
  errCb=(typeof errCb==='function' ? errCb : noop);
  if (!app) {
    return errCb(new Error('App does not exist'));
  }
  if (Boolean(app.started)!==running) {
    return errCb(new Error('App '+(running ? 'not' : 'already')+' running'));
  }
  cb(app, errCb);
}

function waitForStatus(appName, cb) {
  ood.apps[appName].master.once('message', function(msg) {
    if (msg.type==='status') {
      cb(msg.status);
    } else {
      waitForStatus(appName, cb);
    }
  });
}

function getFreePort() {
  var maxPort=ood.config.get('startPort')-1;
  Object.keys(ood.apps).forEach(function(appName) {
    // TODO: should reuse ports later
    maxPort=Math.max(maxPort, ood.appConfig(appName).get('port'));
  });
  return maxPort+1;
}

function appSort(a, b) {
  if (a==='proxy' || b==='proxy') {
    return a==='proxy' ? -1 : 1;
  }
  return a<b ? -1 : 1;
}
