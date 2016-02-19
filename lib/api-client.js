/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var request=require('request'), OOD_DIR=process.env.OOD_DIR || '/etc/ood';

function api(cmd, params, cb) {
  var config;
  if (!api.secret) {
    try {
      config=require(OOD_DIR+'/config.json');
    } catch(err) {
      return cb(err);
    }
    api.port=config.oodPort;
    api.secret=config.secret;
  }
  api.port=api.port || 4126;
  request.post({
    url:'http://127.0.0.1:'+api.port+'/'+cmd,
    headers:{secret:api.secret},
    form:params
  }, function(err, res, body) {
    if (err) {
      if (typeof api.onError==='function') {
        api.onError(err);
      } else if (typeof cb==='function') {
        cb(err);
      }
      return;
    }
    try {
      body=JSON.parse(body);
    } catch(err) {
      if (typeof api.onError==='function') {
        return api.onError(err);
      } else if (typeof cb==='function') {
        return cb(err);
      }
    }
    cb(null, body);
  });
}

function responder(cb, prop) {
  return function apiCallback(err, res) {
    if (err && typeof api.onError==='function') {
      api.onError(err);
    } else if (res && res.error) {
      if (typeof api.onError==='function') {
        api.onError(new Error(res.error));
      } else if (typeof cb==='function') {
        cb(new Error(res.error));
      }
      return;
    } else if (typeof cb!=='function') {
      return;
    }
    if (prop===true) {
      cb(null, res);
      return;
    }
    cb(null, (prop ? res[prop] : undefined));
  };
}

api.init=function(appName, config, cb) {
  api('init', {app:appName, config:config}, responder(cb));
};

api.start=function(appName, cb) {
  api('start', {app:appName}, responder(cb));
};

api.stop=function(appName, cb) {
  api('stop', {app:appName}, responder(cb));
};

api.restart=function(appName, cb) {
  api('restart', {app:appName}, responder(cb));
};

api.scale=function(appName, instances, cb) {
  api('scale', {app:appName, instances:instances}, responder(cb));
};

api.redirect=function(url, target, cb) {
  var change;
  url=url.match(/(?:(https?):\/\/)?([^\/]+)/);
  if (!url) {
    cb(new Error('Invalid URL!'));
  }
  if (target===false) {
    change={delete:'redirect:'+url[2]};
  } else {
    if (target.toLowerCase().substr(0, 4)!=='http') {
      target='http://'+target;
    }
    change={set:'redirect:'+url[2], value:{protocol:url[1], target:target}};
  }
  request('config', change, responder(cb));
};

api.status=function(app, cb) {
  if (typeof app==='function') {
    cb=app;
    app=null;
  }
  api('status', {app:app}, responder(cb, 'status'));
};

api.config={
  get:function(appName, key, cb) {
    if (!cb && typeof key!=='string') {
      cb=key;
      key=appName;
      appName=null;
    }
    api('config', {app:appName, get:key}, responder(cb, 'value'));
  },
  set:function(appName, key, val, cb) {
    if (!cb && (!val || typeof val==='function')) {
      cb=val;
      val=key;
      key=appName;
      appName=null;
    }
    api('config', {app:appName, set:key}, responder(cb));
  },
  delete:function(appName, key, cb) {
    if (!cb && typeof key!=='string') {
      cb=key;
      key=appName;
      appName=null;
    }
    api('config', {app:appName, delete:key}, responder(cb));
  }
};

api.ssl={
  auto:function(appName, email, agree, cb) {
    api('ssl', {auto:appName, email:email, agree:agree}, responder(cb));
  },
  import:function(certs, cb) {
    api('ssl', {list:true}, responder(cb, true));
  },
  list:function(cb) {
    api('ssl', {list:true}, responder(cb, 'list'));
  },
  deleteCert:function(cn, cb) {
    api('ssl', {deleteCert:cn}, responder(cb));
  },
  deleteCa:function(hash, cb) {
    api('ssl', {deleteCa:hash}, responder(cb));
  }
};

api.log=function(appName, cb) {
  // TODO
};

api.mod={
  install:function(modName, cb) {
    api('module', {install:modName}, responder(cb));
  },
  enable:function(modName, cb) {
    api('module', {enable:modName}, responder(cb));
  },
  disable:function(modName, cb) {
    api('module', {disable:modName}, responder(cb));
  },
};

module.exports=api;
