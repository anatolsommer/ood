/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module */
/* jshint strict:global */

'use strict';

var Zocci=require('zocci'), crypto=require('crypto'), defaults, config;

defaults=[
  ['serverID', random()],
  ['secret', random()],
  ['oodPort', 4126],
  ['httpPort', 80],
  ['httpsPort', 443],
  ['startPort', 9000],
  ['script', 'app.js'],
  ['logLevel', 'INFO'],
  ['gid', ''],
  ['app', {}],
  ['redirect', {}]
];

config=new Zocci('/etc/ood/config.json', {delimiter:':', fileMode:416});

defaults.forEach(function(conf) {
  if (!config.get(conf[0])) {
    config.set(conf[0], conf[1]);
  }
});

function random() {
  var id=crypto.randomBytes(16).toString('base64');
  id=id.replace(/[\/+=]/g, function(match) {
    return {'/':'_', '+':'-'}[match] || '';
  });
  return id.match(/^[-_]/) ? random() : id;
}

module.exports=config;
