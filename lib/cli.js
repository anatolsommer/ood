/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,console,setTimeout */
/* jshint strict:global */

'use strict';

var fs=require('fs'), app=require('commander'),async=require('async'),
  zygon=require('zygon'), teselecta=require('teselecta'),
  util=require('./util'), argv=process.argv, api;

if (process.argv[process.argv.length-1]==='install') {
  require('../install');
  return;
}

require('colors');

process.on('uncaughtException', function(err) {
  var stack;
  if (err.code==='EACCES') {
    console.log('You do not have the permission to run this command!'.bold.red);
    console.log('Use sudo or consult: https://oodjs.org/docs/security');
    process.exit();
  } else {
    if (err.stack && err.stack.match) {
      stack=err.stack.match(/(.*)\n([\w\W]*)/);
      console.error('Error: '.bold.red+stack[1]+'\n'+stack[2].grey);
    } else {
      console.error('Fatal error!'.bold.red);
    }
  }
});

api=require('./api-client');

app.command('init <app>')
  .description('Initialise a new app')
  .option('-s, --script <script>', 'Script file (default: app.js)')
  .option('-d, --cwd <dir>', 'Set different working directory')
  .option('-a, --alias <domains>', 'Comma seperated list of alias host names')
  .action(function(appName, opts) {
    var config={};
    config.script=opts.script;
    config.cwd=opts.cwd || process.cwd();
    config.alias=opts.alias || '';
    request('init', {app:appName, config:config}, function(res) {
      if (res.success) {
        app.parse([null, null, 'status', appName]);
      } else {
        console.error(res.error || 'Error!'.bold.red);
      }
    });
  })
  .on('--help', examples([
    'ood init testapp',
    'ood init example.com'
  ]));

app.command('start <app>')
  .description('Start an app')
  .action(function(appName) {
    request('start', {app:appName}, function() {
      setTimeout(function() {
        app.parse([null, null, 'status', appName]);
      }, 1200);
    });
  })
  .on('--help', examples([
    'ood start testapp',
    'ood start example.com'
  ]));

app.command('stop <app>')
  .description('Stop a running app')
  .action(function(appName) {
    request('stop', {app:appName}, function() {
      app.parse([null, null, 'status', appName]);
    });
  })
  .on('--help', examples([
    'ood stop testapp',
    'ood stop example.com'
  ]));

app.command('restart <app>')
  .description('Restart a running app')
  .action(function(appName) {
    request('restart', {app:appName}, function() {
      setTimeout(function() {
        app.parse([null, null, 'status', appName]);
      }, 2000);
    });
  })
  .on('--help', examples([
    'ood restart testapp',
    'ood restart example.com'
  ]));

app.command('scale <app> <instances>')
  .description('Kill or fork new worker instances')
  .action(function(appName, instances) {
    request('scale', {app:appName, instances:instances});
  })
  .on('--help', examples([
    'ood scale testapp 4',
    'ood scale example.com 12'
  ]));

app.command('redirect <host> [target]')
  .description('Set http redirect for a hostname')
  .option('-d, --delete', 'Deletes a redirect')
  .action(function(url, target, opts) {
    var change;
    if (!opts) {
      opts=target;
      target=null;
    }
    url=url.match(/(?:(https?):\/\/)?([^\/]+)/);
    if (!url) {
      return console.error('Invalid URL!'.bold.red);
    }
    if (opts.delete) {
      change={delete:'redirect:'+url[2]};
    } else {
      change={set:'redirect:'+url[2], value:{protocol:url[1], target:target}};
    }
    request('config', change, function(res) {
      if (res.success) {
        console.log('\n  Redirect set.\n'.green);
      } else {
        console.error('\n  Error!\n'.bold.red);
      }
    });
  })
  .on('--help', examples([
    'ood redirect www.example.org http://example.org',
    'ood redirect http://example.com https://example.com',
    'ood redirect www.example.com https://example.com',
    'ood redirect --delete example.com',
    'ood redirect -d example.org'
  ]));

app.command('status')
  .description('Show status of all apps');

app.command('status [app]')
  .description('Show status of a running app')
  .action(function(appName, opts) {
    if (!opts) {
      opts=appName;
      appName=null;
    }
    request('status', {app:appName}, function(res) {
      var tbl=zygon([
        {name:'App name', size:20, color:function(val, row) {
          return row[4] ? 'blue' : 'silver';
        }},
        {name:'PID', size:6, align:'right'},
        {name:'Worker', size:6, align:'right'},
        {name:'State', size:9, color:function(val, row) {
          return {
            online:'cyan',
            listening:'green',
            ok:'green',
            fatal:'red',
            stopped:'grey'
          }[row[3].toLowerCase()];
        }},
        {name:'Uptime', size:13, align:'right', format:uptimeHuman},
        {name:'CPU', size:6, align:'right', format:function(p) {
          return (p===null || p===-1) ? 'N/A'.grey : p.toFixed(1)+'%';
        }},
        {name:'RAM', size:9, align:'right', format:function(b) {
          return (b===null || b===-1) ? 'N/A'.grey :  (b/1048576).toFixed(2)+' MB';
        }}
      ]);

      tbl.printHead();

      Object.keys(res.status).forEach(function(appName) {
        var app=res.status[appName];
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
  })
  .on('--help', examples([
    'ood status',
    'ood status testapp',
    'ood status example.com'
  ]));

app.command('config')
  .description('Modify or show config')
  .option('-a, --app <app>', 'Get or set app configuration')
  .option('-g, --get [key]', 'Get configuration value')
  .option('-s, --set <key> <value>', 'Set configuration value')
  .option('-d, --delete <key>', 'Delete configuration value')
  .action(function(val, opts) {
    var change;
    if (!opts) {
      opts=val;
      val=null;
    }
    change={app:opts.app};
    if (opts.delete) {
      change.delete=opts.delete;
    } else if (opts.get) {
      change.get=(opts.get===true ? '' : opts.get);
    } else if (opts.set) {
      change.set=opts.set;
      change.value=val;
    }
    request('config', change, function(res) {
      var val;
      if (!res.success) {
        return console.error('\n  Error!\n'.bold.red);
      }
      if (opts.get) {
        val=teselecta(res.value, {
          prepend:(typeof opts.get==='string' ? opts.get.bold+': ' : ''),
          spacing:2
        });
        console.log('\n'+val+'\n');
      }
    });
  })
  .on('--help', examples([
    'ood config --get',
    'ood config --get httpPort',
    'ood config --set httpsPort 443',
    'ood config --get --app example.com',
    'ood config -a example.com --get port',
    'ood config -a testapp -s cwd /home/test/testapp',
    'ood config -a testapp -s env.NODE_ENV development',
    'ood config -a testapp --delete env'
  ]));

app.command('ssl')
  .description('Manage ssl settings, certs and keys')
//.option('-a, --auto <app>', 'Get free certificates from letsencrypt.org')
  .option('-i, --import <files>', 'Import certificates and keys')
  .option('-e, --enable <app>', 'Enable ssl for an app')
  .option('-d, --disable <app>', 'Disable ssl for an app')
  .option('-l, --list', 'List all certificates')
  .option('--delete <cn>', 'Delete certificate by CN')
  .action(function() {
    var args=[].slice.call(arguments), opts=args.pop();
    if (opts.import) {
      args.unshift(opts.import);
      async.map(args, fs.readFile, function(err, data) {
        if (err) {
          return console.error('\n  Error: '.bold.red+err.message+'\n');
        }
        request('ssl', {import:data.map(String)}, function(res) {
          console.log();
          res.actions.forEach(function(msg) {
            console.log('  Success: '.green+msg);
          });
          res.errors.forEach(function(err) {
            var file=(typeof err.idx==='number' ? ' ('+args[err.idx].bold+')' : '');
            console.error('  Error: '.bold.red+err.msg+file);
          });
          console.log();
        });
      });
    } else if (opts.list) {
      request('ssl', {list:true}, function(res) {
        var issuers={}, tbl=zygon([
          {name:'Hostname', key:'cn', size:25},
          {name:'altNames', key:'altNames', size:25, format:function(arr) {
            return arr ? arr.join(','.grey) : '';
          }},
          {name:'Issuer', key:'ca', size:35},
          {name:'Expires', key:'expires', size:10}
        ]);

        tbl.printHead();
        tbl.printRows(res.cert);

        res.cert.forEach(function(cert) {
          issuers[cert.caHash]=(issuers[cert.caHash] || 0)+1;
        });

        zygon([
          {name:'CA Certificate', key:'cn', size:40},
          {name:'used', key:'hash', size:5, align:'right', format:function(hash) {
            return issuers[hash] ? issuers[hash]+'x'.grey : 'no'.red;
          }},
          {name:'Hash', key:'hash', size:40},
          {name:'Expires', key:'expires', size:10}
        ], res.ca);

      });
    } else if (opts.enable || opts.disable) {
      // TODO
    } else if (opts.delete) {
      // TODO
    }
  })
  .on('--help', examples([
//  'ood ssl --auto example.com',
    'ood ssl --import key.pem cert.pem ca.pem',
    'ood ssl --enable example.com',
    'ood ssl -l'
  ]));


app.command('log')
  .description('Read log files')
  .action(function() {
    var tbl=zygon([
      {name:'Time', key:'time', size:8, color:'grey', format:function(time) {
        return time.substr(11, 8);
      }},
      {name:'Type', key:'type', size:5, color:logColor},
      {name:'App', key:'app', size:15, color:logColor},
      {name:'Message', key:'msg', size:Infinity}
    ]);
    tbl.printHead();
    util.logReader('/var/log/ood.log', function(log) {
      var info=[];
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
      log.msg=log.msg ? log.msg.bold[logColor(null, log)] : '';
      log.msg=log.msg ? log.msg+'\n'+zygon.cellPadding('', 36) : '';
      log.msg=(log.msg+info.join(', ')).trim();
      tbl.printRow(log);
    });
  });

app.command('install')
  .description('Install and start system service');

app.command('help [command]')
  .description('Show help')
  .action(function(cmd, opts) {
    if (opts) {
      help(cmd);
    } else {
      app.help();
    }
  }).on('--help', examples([
    'ood help init',
    'ood help start',
    'ood help redirect',
    'ood help status',
    'ood help config'
  ]));

app.command('autocomplete')
  .action(function(list, param) {
    if (list==='app') {
     request('config', {get:'app'}, function(res) {
       console.log(Object.keys(res.value).filter(function(app) {
         if (typeof param==='object' || param==='status') {
           return true;
         }
         if (res.value[app].start) {
           return ~['stop', 'restart', 'scale'].indexOf(param);
         } else {
           return param==='start';
         }
       }).join(' '));
     });
    }
  });

app.helpInformation=function() {
  return [
    '\n  Usage: '+this._name+' '+'[command]',
    this.commandHelp().replace('Commands:\n', 'Commands:'.bold),
    ''
  ].join('\n');
};

app.Command.prototype.missingArgument=function(name) {
  process.stdout.write('\n  Error: missing required argument "'+name+'"\n');
  help(this._name);
};

app.Command.prototype.optionMissingArgument=function(option) {
  process.stdout.write('\n  Error: missing required argument "'+option.flags+'"\n');
  help(this._name);
};

app.Command.prototype.unknownOption = function(flag) {
  process.stdout.write('\n  Error: unknown option "'+flag+'"\n');
  help(this._name);
};

app.on('--help', examples([
  'ood help init',
  'ood help config',
  'ood init example.com --alias www.example.com',
  'ood start example.com',
  'ood stop testapp',
  'ood redirect www.example.com https://example.com',
  'ood redirect http://example.com https://example.com',
  'ood redirect --delete www.example.com',
  'ood status',
  'ood config --get',
  'ood config --get httpPort',
  'ood config --set httpsPort 443',
  'ood config --get --app example.com',
  'ood config -ga example.com',
  'ood config -a example.com -g port',
  'ood config -a testapp -s cwd /home/test/testapp',
]));

colorOutput();
app.parse(argv);

if (!app.args.length) {
  app.help();
}

function help(cmd) {
  app.parse(cmd ? [null, null, cmd, '--help'] : []);
}

function examples(lines, title) {
  return function() {
    console.log('  '+(title || 'Examples')+':');
    console.log('    '+lines.join('\n    ')+'\n');
  };
}

function colorOutput() {
  var w=process.stdout.write;
  process.stdout.write=function(data, enc, cb) {
    data=data.toString();
    data=data.replace('  Usage:','  Usage:'.bold);
    data=data.replace('  Options:\n\n','  Options:\n'.bold);
    data=data.replace('  Examples:','  Examples:'.bold);
    data=data.replace('  Error:','  Error:'.bold.red);
    data=data.replace(/  autocomplete +\n/, '');
    w.call(process.stdout, data, enc, cb);
  };
}

function request(cmd, params, cb) {
  params=params || {};
  api(cmd, params, function(err, res) {
    if (err) {
      return console.error('Could not connect to server!'.red+' ('+err.message+')');
    }
    if (~['start', 'stop', 'restart', 'scale'].indexOf(cmd)) {
      if (res.error || !res.success) {
        console.log('\n  '+(res.error || 'Unknown error').bold.red+'\n');
      } else {
        console.log('\n  Command successfully sent!\n'.green);
      }
    }
    if (typeof cb==='function') {
      cb(res);
    }
  });
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

function logColor(val, row) {
  return {ERROR:'red', INFO:'blue', DEBUG:'grey'}[row.type];
}
