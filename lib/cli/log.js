/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module */
/* jshint strict:global */

'use strict';

var zygon=require('zygon'), util=require('../util');

module.exports=function() {
  return function(opts) {
    var logFile='/var/log/ood.log', offset=36, tbl, cols=[
      {name:'Time', key:'time', size:8, color:'grey', format:formatTime},
      {name:'Type', key:'type', size:5, color:logColor},
      {name:'App', key:'app', size:15, color:logColor},
      {name:'Message', key:'msg', size:Infinity}
    ];

    if (opts.filter) {
      opts.filter=opts.filter.split(',').map(function(f) {
        return f.split('=');
      });
    }

    if (opts.app) {
      logFile='/var/log/node/'+opts.app;
      cols.splice(2, 1);
      offset=19;
    }

    tbl=zygon(cols);
    tbl.printHead();

    util.logReader(logFile, function(log) {
      var info=[], spaces=zygon.cellPadding('', offset);

      if (opts.filter && filterLog(opts.filter, log)) {
        return;
      }

      Object.keys(log).forEach(function(key) {
        var val;
        if (!~['time', 'type', 'app', 'msg'].indexOf(key)) {
          val=log[key];
          if (typeof val==='object') {
            val=JSON.stringify(val);
          } else if (typeof val==='string') {
            val=val.replace(/\n/g, '\n  ');
          }
          info.push((key+': '+val).grey);
        }
      });

      log.msg=log.msg ? log.msg.trim().bold[logColor(null, log)] : '';
      log.msg=log.msg ? (log.msg+'\n').replace(/\n/g, '\n'+spaces) : '';
      log.msg=(log.msg+info.join(', ')).trim();
      tbl.printRow(log);
    });
  };
};

function formatTime(time) {
  return time.substr(11, 8);
}

function logColor(val, row) {
  return {ERROR:'red', INFO:'blue', DEBUG:'grey'}[row.type];
}

function filterLog(filter, log) {
  var i;
  for (i in filter) {
    if (log[filter[i][0]]!=filter[i][1]) {
      return true;
    }
  }
}
