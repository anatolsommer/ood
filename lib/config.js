/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module,process */
/* jshint strict:global */

'use strict';

var Zocci=require('zocci'), crypto=require('crypto'), defaults, config,
  OOD_DIR=process.env.OOD_DIR || '/etc/ood';

defaults=[
  ['serverID', random(8)],
  ['secret', random()],
  ['token', random()],
  ['gid', ''],
  ['oodPort', 4126],
  ['httpPort', 80],
  ['httpsPort', 443],
  ['startPort', 9000],
  ['script', 'app.js'],
  ['logDir', '/var/log/node'],
  ['logLevel', 'INFO'],
  ['app', {}],
  ['redirect', {}],
  ['module', {}]
];

config=new Zocci(OOD_DIR+'/config.json', {delimiter:':', fileMode:416});

defaults.forEach(function(conf) {
  if (!config.get(conf[0])) {
    config.set(conf[0], conf[1]);
  }
});

function random(bytes) {
  var id=crypto.randomBytes(bytes || 24).toString('base64');
  id=id.replace(/=/g, '');
  return id.match(/[/+]/) ? random(bytes) : id;
}

module.exports=config;
