/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

exports.logger=function(appName) {
  var Log=require('vinvocci'), log=new Log(null, appName);
  log.componentProp='app';
  return log;
};

exports.parentLogger={
  log:function(level, args) {
    process.send({type:'log', level:level, args:args});
  },
  error:function() {
    exports.parentLogger.log('ERROR', arguments);
  },
  info:function() {
    exports.parentLogger.log('INFO', arguments);
  },
  debug:function() {
    exports.parentLogger.log('DEBUG', arguments);
  }
};

exports.logReader=function(file, opts, cb) {
  var Gelth=require('gelth');
  if (!cb) {
    cb=opts;
    opts={};
  }
  return new Gelth(file, opts).on('data', function(data) {
    try {
      cb(JSON.parse(data));
    } catch(err) {}
  });
};

exports.setGid=function setGid(gid) {
  try {
    process.setgroups(gid ? [gid] : []);
    process.setgid(gid || 'nogroup');
    return;
  } catch(err) {
    try {
      process.setgroups([]);
    } catch(err) {}
  }
  try {
    process.setgid('nogroup');
  } catch(err) {
    process.setgid('nobody');
  }
};
