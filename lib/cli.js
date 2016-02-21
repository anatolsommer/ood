/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var fs=require('fs'), app=require('commander'), api=require('./api-client'),
  OOD_DIR=process.env.OOD_DIR || '/etc/ood', config;

require('colors');

process.on('uncaughtException', function(err) {
  var stack;
  if (err.code==='EACCES') {
    console.error('\n  You do not have the permission to run this command!'.bold.red);
    console.error('  Use sudo or consult: https://oodjs.org/docs/security\n');
  } else if (err.stack && err.stack.match) {
    stack=err.stack.match(/(.*)\n([\w\W]*)/);
    console.error('Error: '.bold.red+stack[1]+'\n'+stack[2].grey);
  } else {
    console.error('Fatal error!'.bold.red);
  }
  process.exit(1);
});

try {
  config=require(OOD_DIR+'/config.json');
  api.secret=config.secret;
  api.port=config.oodPort;
} catch(err) {
  if (!~process.argv.indexOf('install') && !~process.argv.indexOf('help')) {
    throw err;
  }
}

api.onError=function(err) {
  if (err.code==='EACCES') {
    throw err;
  } else {
    console.error('\n  Error: '.red+' '+err.message+'\n');
  }
  process.exit(1);
};

app.command('init <app>')
  .description('Initialise a new app')
  .option('-s, --script <script>', 'Script file (default: app.js)')
  .option('-d, --cwd <dir>', 'Set different working directory')
  .option('-a, --alias <domains>', 'Comma seperated list of alias hostnames')
  .action(function(appName, opts) {
    var config={};
    config.script=opts.script;
    config.cwd=opts.cwd || process.cwd();
    config.alias=opts.alias || '';
    api.init(appName, config, function() {
      app.parse([null, null, 'start', appName]);
    });
  })
  .on('--help', examples([
    'ood init testapp',
    'ood init example.com'
  ]));

app.command('start <app>')
  .description('Start an app')
  .action(function(appName) {
    liveStatus(appName, 2200);
    api.start(appName);
  })
  .on('--help', examples([
    'ood start testapp',
    'ood start example.com'
  ]));

app.command('stop <app>')
  .description('Stop a running app')
  .action(function(appName) {
    liveStatus(appName, 1000);
    api.stop(appName);
  })
  .on('--help', examples([
    'ood stop testapp',
    'ood stop example.com'
  ]));

app.command('restart <app>')
  .description('Restart a running app')
  .action(function(appName) {
    liveStatus(appName, 7000);
    api.restart(appName);
  })
  .on('--help', examples([
    'ood restart testapp',
    'ood restart example.com'
  ]));

app.command('scale <app> <instances>')
  .description('Kill or fork new worker instances')
  .action(function(appName, instances) {
    liveStatus(appName, 3000);
    api.scale(appName, instances);
  })
  .on('--help', examples([
    'ood scale testapp 4',
    'ood scale example.com 12'
  ]));

app.command('redirect <host> [target]')
  .description('Set http redirect for a hostname')
  .option('-d, --delete', 'Deletes a redirect')
  .action(function(url, target, opts) {
    if (target && target.delete) {
      target=false;
    }
    api.redirect(url, target, function(err, res) {
      console.log('\n  Redirect '+(target ? 'set' : 'deleted')+'.\n'.green);
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
  .action(require('./cli/status')(api))
  .on('--help', examples([
    'ood status',
    'ood status testapp',
    'ood status example.com'
  ]));

app.command('config')
  .description('Modify or show configuration')
  .option('-a, --app <app>', 'Get or set app configuration (optional)')
  .option('-g, --get [key]', 'Get configuration value')
  .option('-s, --set <key> <value>', 'Set configuration value')
  .option('-d, --delete <key>', 'Delete configuration value')
  .action(require('./cli/config')(api))
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
  .action(require('./cli/ssl')(api))
  .on('--help', examples([
    'ood ssl --import key.pem cert.pem ca.pem',
    'ood ssl --auto example.com --email me@example.com --agree',
    'ood ssl --auto example.org # (If you supplied --email before)',
    'ood ssl --list'
  ]));

app.command('log')
  .description('Read log files (live)')
  .option('-a, --app <app>', 'Read app logs')
  .option('-n, --lines <count>', 'Print last x lines (default: 20)')
  .option('-f, --filter <key=value>', 'Define a filter')
  .action(require('./cli/log')(api, config))
  .on('--help', examples([
    'ood log',
    'ood log -n 50 --app example.com',
    'ood log --filter pid=2342',
    'ood log -a example.com -f workerId=13,type=ERROR'
  ]));

app.command('mod')
  .description('Manage ood modules')
  .option('-i, --install <package>', 'Install an ood module from npm')
  .option('-e, --enable <module>', 'Enable an installed module')
  .option('-d, --disable <module>', 'Disable a module')
  .option('-l, --list', 'List installed modules')
  .action(require('./cli/module')(api))
  .on('--help', examples([
    'ood module --install prtg',
    'ood module --enable prtg',
    'ood module -l'
  ]));

app.command('install')
  .description('Install ood and start system service')
  .option('-l, --log-dir', 'Set log directory (default: /var/log/node)')
  .option('-g, --group', 'Set ood system group')
  .option('--http', 'Set http port (default: 80)')
  .option('--https', 'Set https port (default: 443)')
  .action(function(opts) {
    require('../install').install(opts);
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
     api.config.get('app', function(err, apps) {
       console.log(Object.keys(apps).filter(function(app) {
         if (typeof param==='object' || param==='status') {
           return true;
         }
         if (apps[app].start) {
           return ~['stop', 'restart', 'scale'].indexOf(param);
         } else {
           return param==='start';
         }
       }).join(' '));
     });
    } else if (list==='ssl') {
      api.ssl.list(function(err, list) {
        console.log(list[param==='ca' ? 'ca' : 'cert'].map(function(c) {
          return param==='ca' ? c.hash : c.cn;
        }).join(' '));
      });
    } else if (list==='mod') {
      api.mod.list(function(err, list) {
        console.log(list.filter(function(mod) {
          return mod.enabled===(param==='_--disable' || param==='_-d');
        }).map(function(mod) {
          return mod.name;
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
  'ood scale example.com 4',
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
app.parse(process.argv);

if (!app.args.length) {
  app.help();
}

function liveStatus(appName, delay) {
  var log=require('./cli/log')(api, config)({lines:0, filter:'app='+appName});
  setTimeout(function() {
    log.end();
    app.parse([null, null, 'status', appName]);
  }, delay);
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
