/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var Zocci=require('zocci'), crypto=require('crypto'), defaults, config,
  OOD_DIR=process.env.OOD_DIR || '/etc/ood';

defaults=[
  ['serverID', random.bind(null, 8)],
  ['secret', random.bind()],
  ['token', random.bind()],
  ['gid', ''],
  ['oodPort', 4126],
  ['httpPort', 80],
  ['httpsPort', 443],
  ['startPort', 9000],
  ['script', 'app.js'],
  ['logDir', '/var/log/node'],
  ['logLevel', 'INFO'],
  ['app', {proxy:{start:true}}],
  ['redirect', {}],
  ['mod', {}]
];

config=new Zocci(OOD_DIR+'/config.json', {delimiter:':', fileMode:416});

defaults.forEach(function(conf) {
  if (config.get(conf[0])===null) {
    config.set(conf[0], conf[1]);
  }
});

function random(bytes) {
  var id=crypto.randomBytes(bytes || 24).toString('base64');
  id=id.replace(/=/g, '');
  return id.match(/[/+]/) ? random(bytes) : id;
}

module.exports=config;
