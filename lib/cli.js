/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process,console,setTimeout,__dirname */
/* jshint strict:global */

'use strict';

var fs=require('fs'), app=require('commander'), teselecta=require('teselecta'),
  argv=process.argv, api;

require('colors');

process.on('uncaughtException', function(err) {
  var stack;
  if (err.stack && err.stack.match) {
    stack=err.stack.match(/(.*)\n([\w\W]*)/);
    console.error('Error: '.bold.red+stack[1]+'\n'+stack[2].grey);
  } else {
    console.error('Fatal error!'.bold.red);
  }
});

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
        app.parse([null, null, 'start', appName]);
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
      }, 2200);
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
      }, 3100);
    });
  })
  .on('--help', examples([
    'ood restart testapp',
    'ood restart example.com'
  ]));

app.command('scale <app> <instances>')
  .description('Kill or fork new worker instances')
  .action(function(appName, instances) {
    request('scale', {app:appName, instances:instances}, function() {
      setTimeout(function() {
        app.parse([null, null, 'status', appName]);
      }, 3100);
    });
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
      if (target.toLowerCase().substr(0, 4)!=='http') {
        target='http://'+target;
      }
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
  .action(require('./cli/status')(request))
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
  .description('Manage ssl certificates and keys')
  .option('-i, --import <files>', 'Import certificates and keys')
  .option('-l, --list', 'List all certificates')
  .option('-a, --auto <app>', 'Get free certificates from letsencrypt.org')
  .option('-e, --email <email>', 'Account email address for letsencrypt.org')
  .option('--agree', 'You have to agree the letsencrypt.org terms of use')
  .option('--delete <cn>', 'Delete certificate by CN')
  .option('--delete-ca <hash>', 'Delete CA certificate by hash')
  .action(require('./cli/ssl')(request))
  .on('--help', examples([
    'ood ssl --import key.pem cert.pem ca.pem',
    'ood ssl --auto example.com --email me@example.com --agree',
    'ood ssl --auto example.org # (If you supplied --email before)',
    'ood ssl --list'
  ]));

app.command('log')
  .description('Read log files')
  .option('-a, --app <app>', 'Read app logs')
  .option('-f, --filter <key=value>', 'Define a filter')
  .action(require('./cli/log')())
  .on('--help', examples([
    'ood log',
    'ood log --app example.com',
    'ood log --filter pid=2342',
    'ood log -a example.com -f workerId=13,type=ERROR'
  ]));

app.command('mod')
  .description('Manage ood modules')
  .option('-i, --install <package>', 'Install an ood module from npm')
  .option('-e, --enable <module>', 'Enable an installed module')
  .option('-d, --disable <module>', 'Disable a module')
  .option('-l, --list', 'List installed modules')
  .action(require('./cli/module')(request))
  .on('--help', examples([
    'ood module --install prtg',
    'ood module --enable prtg',
    'ood module -l'
  ]));

app.command('install')
  .description('Install and start system service')
  .action(function() {
    require('../install');
  });

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
    } else if (list==='ssl') {
      request('ssl', {list:true}, function(res) {
        console.log(res[param==='ca' ? 'ca' : 'cert'].map(function(c) {
          return param==='ca' ? c.hash : c.cn;
        }).join(' '));
      });
    } else {
      fs.createReadStream(__dirname+'/../templates/autocomplete.sh')
        .pipe(process.stdout);
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
  'ood status',
  'ood redirect www.example.com https://example.com',
  'ood redirect http://example.com https://example.com',
  'ood redirect --delete www.example.com',
  'ood config --get',
  'ood config --get httpPort',
  'ood config --set httpsPort 443',
  'ood config --get --app example.com',
  'ood config -ga example.com',
  'ood config -a example.com -g port',
  'ood config -a testapp -s cwd /home/test/testapp',
  'ood ssl --auto example.com --email me@example.com --agree',
  'ood ssl --auto example.org # (If you supplied --email before)',
  'ood ssl --list'
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
  api=api || require('./api-client');
  params=params || {};
  api(cmd, params, function(err, res) {
    if (err && err.code==='EACCES') {
      console.error('You do not have the permission to run this command!'.bold.red);
      console.error('Use sudo or consult: https://oodjs.org/docs/security');
      return;
    } else if (err) {
      console.error('Could not connect to server!'.red+' ('+err.message+')');
      return;
    }
    if (~['start', 'stop', 'restart', 'scale'].indexOf(cmd)) {
      if (res.error || !res.success) {
        console.log('\n  '+(res.error || 'Unknown error').bold.red+'\n');
      } else {
        console.log('\n  Command successfully sent!'.green);
      }
    }
    if (typeof cb==='function') {
      cb(res);
    }
  });
}
