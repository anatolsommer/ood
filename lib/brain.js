/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var child=require('child_process'), fs=require('fs'),
  mkdirp=require('mkdirp'), Log=require('vinvocci'),
  apiServer=require('./api-server'), util=require('./util'),
  log=util.logger('ood-brain'), noop=function() {}, ood={};

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

ood.startApps=function() {
  log.debug('Starting apps...');
  Object.keys(ood.apps).forEach(function(appName) {
    if (ood.appConfig(appName).get('start')) {
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
    master:null,
    errors:[]
  };
  config.script=config.script || 'app.js';
  config.port=getFreePort();
  ood.config.set('app:'+appName, config, cb);
  ood.updateProxy();
  log.info('Initialised new app', {appName:appName});
};

ood.start=function(appName, cb) {
  getApp(appName, cb, false, function(app, cb) {
    var config=ood.appConfig(appName), logDir;
    log.debug('Starting app', {appName:appName});
    config.set('start', true);
    app.started=Date.now();
    if (!app.log) {
      logDir=ood.config.get('logDir')+'/';
      app.log=new Log(Log.DEBUG, null, logDir+appName+'-app.log');
      if (appName!=='proxy') {
        app.accessLog=fs.createWriteStream(
          logDir+'/'+appName+'-access.log',
          {flags:'a', mode:420}
        );
      }
    }
    app.master=child.fork(__dirname+'/appContainer', {
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
        if (msg.level==='ERROR') {
          app.errors.push(Date.now());
        }
        log.log(msg.level, msg.args);
      } else if (msg.type==='appLog') {
        app.log.log(msg.level, msg.args);
      } else if (appName==='proxy') {
        if (msg.type==='accessLog') {
          if (ood.apps[msg.app] && ood.apps[msg.app].accessLog) {
            ood.apps[msg.app].accessLog.write(msg.log+'\n');
          } else if (ood.mods[msg.mod] && ood.mods[msg.mod].accessLog) {
            ood.mods[msg.mod].accessLog.write(msg.log+'\n');
          }
        } else if (msg.type==='workerStarted') {
          ood.updateProxy(msg.pid);
        }
      }
    });
    app.master.on('exit', function(code) {
      app.master.removeAllListeners();
      if (app.log) {
        app.log.stream.end();
        app.log=null;
      }
      if (app.accessLog) {
        app.accessLog.end();
        app.accessLog=null;
      }
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
        appStatus.errors=ood.apps[appName].errors.length;
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
  var config={}, hosts={app:{}, redirect:{}, mod:{}};
  if (!ood.apps.proxy.master) {
    return;
  }
  config.httpPort=ood.config.get('httpPort');
  config.httpsPort=ood.config.get('httpsPort');
  config.token=ood.config.get('token');
  hosts.redirect=ood.config.get('redirect');
  Object.keys(ood.mods).forEach(function(modName) {
    var mod=ood.mods[modName];
    if (mod.enabled && mod.proxyPath) {
      hosts.mod[mod.proxyPath]={
        modName:modName,
        port:mod.port,
        auth:!mod.proxyNoAuth
      };
    }
  });
  Object.keys(ood.apps).forEach(function(appName) {
    var port, config;
    if (appName!=='proxy') {
      config=ood.appConfig(appName);
      appName=appName.toLowerCase();
      port=config.get('port');
      hosts.app[appName]={appName:appName, port:port};
      if (config.get('alias')) {
        config.get('alias').split(/[,; ]+/).forEach(function(host) {
          hosts.app[host.toLowerCase()]=hosts.app[appName];
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

ood.installModule=function(modName, cb) {
  child.exec(
    'npm install -g ood-'+modName,
    function(cerr, stdout, stderr) {
      var mod, pkg;
      if (cerr || stderr) {
        cb(cerr || new Error('Error running npm install'));
        return;
      }
      try {
        pkg=require('ood-'+modName+'/package.json');
      } catch(err) {
        return cb(new Error('Error reading package.json'));
      }
      try {
        mod=require('ood-'+modName+'/ood.json');
      } catch(err) {
        return cb(new Error('Error reading ood.json'));
      }
      if (!~['app'].indexOf(mod.type)) {
        return cb(new Error('Module specifies invalid type'));
      }
      if (mod.proxyPath && mod.proxyPath.substr(0, 3)!=='ood') {
        return cb(new Error('Module specifies invalid proxyPath'));
      }
      if (mod.proxyPath) {
        mod.port=getFreePort();
      }
      mod.enabled=false;
      ood.mods[modName]=mod;
      ood.config.set('mod:'+modName, mod);
      log.info('Installed module', {name:modName, version:pkg.version});
      cb(null, pkg, mod);
    }
  );
};

ood.loadModule=function(modName) {
  var mod=ood.mods[modName];
  log.info('Loading module: '+modName);
  if (mod.type==='app') {
    if (mod.master) {
      return;
    }
    mod.master=child.fork(
      __dirname+'/modContainer',
      {execArgv:['--expose-gc'], silent:true}
    );
    mod.master.send({
      cmd:'load',
      modName:modName,
      config:ood.config.get('mod:'+modName),
      secret:(mod.api ? ood.config.get('secret') : null)
    });
    mod.master.on('message', function(msg) {
      if (msg.type==='log') {
        msg.args[1]=msg.args[1] || {};
        msg.args[1].app=modName;
        log.log(msg.level, msg.args);
      }
    });
    mod.master.on('exit', function(code) {
      mod.master.removeAllListeners();
      mod.master=null;
      if (mod.accessLog) {
        mod.accessLog.end();
        mod.accessLog=null;
      }
      if (code!==0) {
        log.error('Disabling crashed module.', {module:modName, exitCode:code});
        mod.enabled=false;
        ood.config.set('mod:'+modName+':enabled', false);
      }
    });
    if (mod.proxyPath) {
      mod.accessLog=fs.createWriteStream(
        ood.config.get('logDir')+'/mod-'+modName+'-access.log',
        {flags:'a', mode:416}
      );
      ood.updateProxy();
    }
  }
};

ood.unloadModule=function(modName) {
  var mod=ood.mods[modName];
  log.info('Unloading module: '+modName);
  if (mod.type==='app' && mod.master) {
    try {
      mod.master.send({cmd:'unload'});
    } catch(err) {
      mod.master.kill();
    }
    setTimeout(function() {
      mod.master.kill();
      mod.master=null;
    }, 190);
  }
};

ood.postRotate=function() {
  log.debug('Reopening log files');
  redirectOutput();
  Object.keys(ood.apps).forEach(function(appName) {
    reopenFile(ood.apps[appName]);
  });
  Object.keys(ood.mods).forEach(function(modName) {
    reopenFile(ood.mods[modName], 416);
  });
};

process.on('SIGTERM', function() {
  log.info('Got SIGTERM, exiting');
  Object.keys(ood.apps).forEach(function(appName) {
    if (ood.apps[appName].started) {
      ood.apps[appName].started=false;
      log.debug('Stopping app', {appName:appName});
      ood.msg(appName, {cmd:'stop'});
    }
  });
  Object.keys(ood.mods).forEach(function(modName) {
    if (ood.mods[modName].master) {
      ood.unloadModule(modName);
    }
  });
  setTimeout(function() {
    process.exit();
  }, 200);
});

process.on('SIGUSR2', ood.postRotate);

process.on('uncaughtException', function(err) {
  console.error(JSON.stringify({
    time:new Date(),
    type:'ERROR',
    app:'ood-brain',
    msg:'Uncaught exception',
    stack:err.stack
  }));
});

init();

function init() {
  ood.config=require('./config');
  mkdirp.sync(ood.config.get('logDir'));
  redirectOutput();

  ood.logLevel=ood.config.get('logLevel') || 'INFO';
  log.setLevel(ood.logLevel);
  log.info('Starting...');

  if (ood.config.get('gid')) {
    process.setgid(ood.config.get('gid'));
    ood.config.save();
  }

  ood.config.on('change', function(key, val) {
    key=key.split(':');
    if (key[0]==='logLevel' && val) {
      log.setLevel(val);
    } else if (key[0]==='gid' && val) {
      process.setgid(val);
    } else if (key[0]==='redirect' || key[key.length-1]==='alias') {
      setTimeout(ood.updateProxy, 1);
    } else if (~['httpPort', 'httpsPort'].indexOf(key[0])) {
      ood.restart('proxy');
    } else if (key[0]==='app' && key.length===2 && !val && ood.apps[key[1]]) {
      if (ood.apps[key[1]].started) {
        ood.stop(key[1]);
      }
      delete ood.apps[key[1]];
    }
  });

  ood.appConfig=ood.config.subSelector('app');
  ood.apps={
    proxy:{
      started:false,
      status:{},
      master:null,
      errors:[],
      config:{
        script:'./proxy',
        cwd:__dirname,
        uid:'root',
        instances:ood.config.get('app:proxy:instances', 4)
      }
    }
  };

  ood.mods=ood.config.get('mod');
  Object.keys(ood.mods).forEach(function(modName) {
    if (!ood.mods[modName].enabled) {
      return;
    }
    ood.loadModule(modName);
  });

  Object.keys(ood.config.get('app')).forEach(function(appName) {
    if (appName==='proxy') {
      return;
    }
    ood.apps[appName]={
      started:false,
      status:{},
      master:null,
      errors:[]
    };
  });

  ood.startApps();
  apiServer.start(ood);
  autoRenewCerts();
  filterAppErrors();
}

function autoRenewCerts() {
  setTimeout(autoRenewCerts, 43200000);
  ood.certMgr.autoRenew();
}

function filterAppErrors() {
  setTimeout(filterAppErrors, 30000);
  Object.keys(ood.apps).forEach(function(appName) {
    var app=ood.apps[appName];
    app.errors=app.errors.filter(timeFilter);
  });
}

function timeFilter(ts) {
  return Date.now()-ts<600000;
}

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
  var port=ood.config.get('startPort'), used, i;
  used=Object.keys(ood.apps).map(function(appName) {
    return ood.appConfig(appName).get('port');
  });
  Object.keys(ood.mods).forEach(function(modName) {
    if (ood.mods[modName].port) {
      used.push(ood.mods[modName].port);
    }
  });
  for (i=port; i<port+999; i++) {
    if (!~used.indexOf(i)) {
      return i;
    }
  }
  log.error('All ports in use');
}

function redirectOutput() {
  var write;
  if (ood.logStream) {
    ood.logStream.end();
  }
  ood.logStream=fs.createWriteStream(
    ood.config.get('logDir')+'/ood.log',
    {flags:'a', mode:416}
  );
  write=ood.logStream.write.bind(ood.logStream);
  process.stdout.write=write;
  process.stderr.write=write;
}

function reopenFile(obj, mode) {
  if (obj.log) {
    obj.log.stream.end();
    obj.log.stream=fs.createWriteStream(obj.log.stream.path, {flags:'a'});
  }
  if (obj.accessLog) {
    obj.accessLog.end();
    obj.accessLog=fs.createWriteStream(
      obj.accessLog.path,
      {flags:'a', mode:mode || 420}
    );
  }
}

function appSort(a, b) {
  if (a==='proxy' || b==='proxy') {
    return a==='proxy' ? -1 : 1;
  }
  return a<b ? -1 : 1;
}
