/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var configType={
  number:['port', 'oodPort', 'httpPort', 'httpsPort', 'instances', 'killDelay'],
  bool:['start', 'maintenance', 'enabled', 'api']
};

exports.start=function startServer(ood) {
  var express=require('express'), bodyParser=require('body-parser'),
    log=require('./util').logger('ood-api-server'), app=express(), server,
    secret=ood.config.get('secret'), port=ood.config.get('oodPort');

  log.setLevel(ood.logLevel);
  log.info('Starting...');

  ood.config.on('change', function(key, val) {
    if (key==='logLevel') {
      log.setLevel(val);
    } else if (key==='secret') {
      secret=val;
    } else if (key==='oodPort') {
      port=val;
      server.close();
      server=app.listen(port, '127.0.0.1');
    }
  });

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended:true}));

  app.use(function checkSecret(req, res, next) {
    if (req.headers.secret!==secret) {
      log.info('Unauthenticated request', {url:req.originalUrl});
      res.status(403);
      res.json({error:'Denied'});
    } else {
      log.debug('Got request', {url:req.originalUrl, body:req.body});
      next();
    }
  });

  app.post('/init', function(req, res) {
    var config=req.body.config;
    if (config.instances) {
      config.instances=Number(config.instances);
    }
    if (config.killDelay) {
      config.killDelay=Number(config.killDelay);
    }
    if (!config.cwd) {
      res.status(500);
      res.json({error:'No "cwd" specified!'});
      return;
    }
    ood.init(req.body.app, config, function(err) {
      if (err) {
        res.status(500);
        res.json({error:'Server error'});
        return;
      }
      res.json({success:true});
    });
  });

  function cmdHandler(cmd) {
    return function(req, res) {
      ood[cmd](req.body.app, handleResponse(res));
    };
  }

  ['start', 'stop', 'restart'].forEach(function(cmd) {
    app.post('/'+cmd, cmdHandler(cmd));
  });

  app.post('/scale', function(req, res) {
    ood.scale(req.body.app, Number(req.body.instances), handleResponse(res));
  });

  app.post('/status', function(req, res) {
    ood.status(function(status) {
      var ret={};
      if (req.body.app) {
        if (!status[req.body.app]) {
          appNotFound(res);
          return;
        }
        ret[req.body.app]=status[req.body.app];
      } else {
        ret=status;
      }
      res.json({success:true, status:ret});
    });
  });

  app.post('/config', function(req, res) {
    var config=ood.config;
    convertConfigType(req.body);
    if (req.body.app) {
      if (!ood.apps[req.body.app]) {
        appNotFound(res);
        return;
      }
      config=ood.appConfig(req.body.app);
    }
    if (typeof req.body.get!=='undefined') {
      res.json({success:true, value:config.get(req.body.get)});
    } else if (req.body.set) {
      config.set(req.body.set, req.body.value, handleResponse(res));
    } else if (req.body.delete) {
      config.remove(req.body.delete, handleResponse(res));
    } else {
      res.json({error:'Method not found'});
    }
  });

  app.post('/ssl', function(req, res) {
    if (req.body.import) {
      ood.certMgr.import(req.body.import, function(result) {
        res.json(result);
      });
    } else if (req.body.list) {
      ood.certMgr.getList(function(err, list) {
        res.json({list:list});
      });
    } else if (req.body.deleteCert || req.body.deleteCa) {
      ood.certMgr['delete'+(req.body.deleteCa ? 'Ca' : 'Cert')](
        req.body.deleteCert || req.body.deleteCa,
        handleResponse(res)
      );
    } else if (req.body.auto) {
      var domains;
      if (ood.apps[req.body.auto]) {
        domains=ood.appConfig(req.body.auto).get('alias');
        domains=(domains ? domains.split(',') : []);
        if (~req.body.auto.indexOf('.')) {
          domains.unshift(req.body.auto);
        }
        if (!domains.length) {
          res.json({error:'No valid domain names found.'});
          return;
        }
      } else {
        appNotFound(res);
        return;
      }
      ood.certMgr.autoSSL(domains, req.body.email, handleResponse(res));
    }
  });

  app.post('/log', function(req, res) {
    // TODO
  });

  app.post('/module', function(req, res) {
    var list;
    if (req.body.install) {
      ood.installModule(req.body.install, function(err, pkg, mod) {
        if (err) {
          return res.json({error:err.message});
        }
        res.json({success:true});
      });
    } else if (req.body.enable || req.body.disable) {
      if (!ood.mods[req.body.enable || req.body.disable]) {
        return res.json({error:'Module not found'});
      }
      if (req.body.enable) {
        ood.mods[req.body.enable].enabled=true;
        ood.config.set('mod:'+req.body.enable+':enabled', true);
        ood.loadModule(req.body.enable);
      } else {
        ood.mods[req.body.disable].enabled=false;
        ood.config.set('mod:'+req.body.disable+':enabled', false);
        ood.unloadModule(req.body.disable);
      }
      res.json({success:true});
    } else if (req.body.list) {
      list=Object.keys(ood.mods).map(function(modName) {
        return {name:modName, enabled:ood.mods[modName].enabled};
      });
      res.json({success:true, list:list});
    }
  });

  app.use(function errorHandler(err, req, res, next) {
    log.error('Error in api server', {url:req.originalUrl, stack:err.stack});
    if (res.headersSent) {
      return next(err);
    }
    res.status(500);
    res.json({error:'Server error'});
  });

  app.use(function notFound(req, res) {
    res.status(404);
    res.json({error:'Not found'});
  });

  log.info('Listening on port '+port);
  server=app.listen(port, '127.0.0.1');
};

function appNotFound(res) {
  res.json({error:'App does not exist!'});
}

function convertConfigType(body) {
  if (~configType.number.indexOf(body.set)) {
    body.value=Number(body.value);
  } else if (~configType.bool.indexOf(body.set)) {
    body.value=(['false', 'no', '0', ''].indexOf(body.value)===-1);
  }
}

function handleResponse(res) {
  return function(err) {
    res.json({success:!err, error:err ? err.message : undefined});
  };
}
