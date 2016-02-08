/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module,process */
/* jshint strict:global, -W002 */

'use strict';

var request=require('request'), OOD_DIR=process.env.OOD_DIR || '/etc/ood',
  config=require(OOD_DIR+'/config.json');

function api(cmd, params, cb) {
  request.post({
    url:'http://127.0.0.1:'+config.oodPort+'/'+cmd,
    headers:{secret:config.secret},
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

// TODO: other api mehods

module.exports=api;
