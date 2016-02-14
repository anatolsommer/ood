/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var mod, log=require(__dirname+'/util').parentLogger;

process.on('message', function(msg) {
  var api;

  if (msg.cmd==='load') {
    process.title='ood-mod: '+msg.modName;
    mod=mod || require('ood-'+msg.modName+'/lib/app');
    if (msg.secret) {
      api=api || require('./api-client');
      api.secret=msg.secret;
    }
    if (mod && typeof mod.load==='function') {
      mod.load(log, api, msg.config);
    }
  } else if (msg.cmd==='unload') {
    if (mod && typeof mod.unload==='function') {
      mod.unload(log);
    }
    setTimeout(function() {
      process.exit();
    }, 180);
  }
});
