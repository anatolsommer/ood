/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals exports,require */
/* jshint strict:global */

'use strict';

exports.start=function(ood) {
  var express=require('express'), bodyParser=require('body-parser'),
    log=require('./util').logger('ood-api-server'), app=express(),
    secret=ood.config.get('secret'), port=ood.config.get('oodPort');

  log.setLevel(ood.logLevel);
  log.info('Starting...');

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
          res.status(500);
          res.json({error:'App does not exist!'});
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
    convertType(req.body);
    if (req.body.app) {
      if (!ood.apps[req.body.app]) {
        res.status(500);
        res.json({error:'App does not exist!'});
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

  app.post('/log', function(req, res) {
    // TODO
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
  app.listen(port, '127.0.0.1');
};

function convertType(body) {
  if (~['port', 'instances', 'killDelay'].indexOf(body.set)) {
    body.value=Number(body.value);
  } else if (~['disableProxy', 'start'].indexOf(body.set)) {
    body.value=(['false', 'no', '0', ''].indexOf(body.value)===-1);
  }
}

function handleResponse(res) {
  return function(err) {
    res.json({success:!err, error:err ? err.message : undefined});
  };
}
