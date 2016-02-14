/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module */
/* jshint strict:global */

'use strict';

var zygon=require('zygon');

module.exports=function(api) {
  return function(appName, opts) {
    if (!opts) {
      opts=appName;
      appName=null;
    }
    api.status(appName, function(err, status) {
      var tbl=zygon([
        {name:'App name', size:20, color:appColor},
        {name:'PID', size:6, align:'right'},
        {name:'Worker', size:6, align:'right'},
        {name:'State', size:9, color:stateColor},
        {name:'Uptime', size:13, align:'right', format:uptimeHuman},
        {name:'CPU', size:6, align:'right', format:formatCPU},
        {name:'RAM', size:9, align:'right', format:formatRAM}
      ]);

      tbl.printHead();

      Object.keys(status).forEach(function(appName) {
        var app=status[appName];
        if (app==='stopped') {
          tbl.printRow([appName, '', '', 'stopped']);
        } else {
          tbl.printRow([
            appName,
            app.master.pid,
            'MASTER',
            app.master.state,
            app.master.startTime,
            (app.master.usage ? app.master.usage.cpu : -1),
            (app.master.usage ? app.master.usage.ram : -1)
          ]);
          app.workers.forEach(function(worker) {
            tbl.printRow([
              '',
              worker.pid,
              '#'+worker.workerId,
              worker.state,
              worker.startTime,
              (worker.usage ? worker.usage.cpu : -1),
              (worker.usage ? worker.usage.ram : -1)
            ]);
          });
        }
      });

      tbl.end();
    });
  };
};

function appColor(val, row) {
  return row[4] ? 'reset' : 'silver';
}

function stateColor(val, row) {
  return {
    online:'cyan',
    starting:'cyan',
    listening:'green',
    running:'green',
    fatal:'red',
    stopped:'grey',
    stopping:'grey'
  }[row[3].toLowerCase()];
}

function uptimeHuman(time) {
  var ms=Date.now()-time, s=Math.floor(ms/1000), m, h, d;
  m=Math.floor(s/60);
  s=s % 60;
  h=Math.floor(m/60);
  m=m % 60;
  d=Math.floor(h/24);
  h=h % 24;
  s=s<10 ? '0'+s : s;
  m=m<10 ? '0'+m : m;
  h=h<10 ? '0'+h : h;
  return (d+'d ')[d>0 ? 'reset' : 'grey']+h+':'+m+':'+s;
}

function formatCPU(p) {
  return (p===null || p===-1) ? 'N/A'.grey : p.toFixed(1)+'%';
}

function formatRAM(b) {
  return (b===null || b===-1) ? 'N/A'.grey : (b/1048576).toFixed(2)+' MB';
}
