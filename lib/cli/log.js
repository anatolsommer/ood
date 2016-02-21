/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var zygon=require('zygon'), util=require('../util');

module.exports=function(api, config) {
  return function(opts) {
    var logFile=config.logDir+'/ood.log', offset=36, tbl, reader, buf=[], cols=[
      {name:'Time', key:'time', size:8, color:'grey', format:formatTime},
      {name:'Type', key:'type', size:5, color:logColor},
      {name:'App', key:'app', size:15, color:logColor},
      {name:'Message', key:'msg', size:Infinity}
    ];

    opts.lines=(typeof opts.lines!=='undefined' ? Number(opts.lines) : 20);

    tbl=zygon(cols);
    tbl.printHead();

    if (opts.app) {
      logFile=config.logDir+'/'+opts.app+'-app.log';
      cols.splice(2, 1);
      offset=19;
    }

    if (opts.filter) {
      opts.filter=opts.filter.split(',').map(function(f) {
        return f.split('=');
      });
      if (opts.lines) {
        reader=util.logReader(logFile, {
          lines:1000
        }, function(log) {
          buf.push(log);
        });
        reader.once('reading', function() {
          reader._stream.on('end', function() {
            buf.filter(function(log) {
              return log && !filterLog(opts.filter, log);
            }).slice(-opts.lines).forEach(printLog);
          });
          followLog(0);
        });
      } else {
        followLog(0);
      }
    } else {
      followLog(opts.lines);
    }

    function followLog(lines) {
      reader=util.logReader(logFile, {lines:lines, follow:true}, printLog);
    }

    function printLog(log) {
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
    }

    return reader;
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
    if (String(log[filter[i][0]])!==filter[i][1]) {
      return true;
    }
  }
}
