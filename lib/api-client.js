/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var request=require('request'), config=require('./config'),
  port=config.get('oodPort'), secret=config.get('secret');

function api(cmd, params, cb) {
  request.post({
    url:'http://127.0.0.1:'+port+'/'+cmd,
    headers:{secret:secret},
    form:params
  }, function(err, res, body) {
    if (err) {
      if (typeof cb==='function') {
        cb(err);
      }
      return;
    }
    try {
      body=JSON.parse(body);
    } catch(err) {
      if (typeof cb==='function') {
        return cb(err);
      }
    }
    cb(null, body);
  });
}

// TODO

api.scale=function(app, instances, cb) {
  api('scale', {
    app:app,
    instances:instances
  }, function(err, res) {
    cb(err || res.error);
  });
};

api.status=function(cb) {
  api('status', {}, function(err, res) {
    cb(err || res.error, res.status);
  });
};

module.exports=api;
