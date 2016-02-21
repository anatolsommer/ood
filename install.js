/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var fs=require('fs'), mkdirp=require('mkdirp'), pidof=require('pidof'),
  exec=require('child_process').exec, type, destination, template;

exports.install=function(opts) {
  opts=(typeof opts==='object' ? opts : {});

  require('async').series([

    function prepareInstall(done) {
      process.stdout.write('\n  ood installer\n');
      write('Preparing installation', true);
      pidof('systemd', function(err, pid) {
        if (pid) {
          type='systemd';
          destination='/etc/systemd/system/ood.service';
          template='ood.service';
        } else {
          destination='/etc/init.d/ood';
          template='ood-init.sh';
        }
        done();
      });
    },

    function loadServiceTemplate(done) {
      write('Loading service template');
      fs.readFile(__dirname+'/templates/'+template, function(err, tmpl) {
        if (err) {
          return done(err);
        }
        write('Creating service file');
        tmpl=tmpl.toString()
          .replace(/%NODE%/g, process.execPath)
          .replace(/%OOD%/g, __dirname+'/service');
        fs.writeFile(destination, tmpl, {mode:493}, done);
      });
    },

    function createEtcOod(done) {
      write('Creating /etc/ood directory');
      mkdirp('/etc/ood', {mode:488}, done);
    },

    function createGroup(done) {
      if (!opts.group) {
        return done();
      }
      try {
        process.setgid(opts.group);
        done();
      } catch(err) {
        write('Creating group "'+opts.gid+'"');
        exec('addgroup '+opts.group, function(err) {
          if (err) {
            return done(err);
          }
          process.setgid(opts.group);
          done();
        });
      }
    },

    function createConfig(done) {
      var config;
      write('Creating config file');
      config=require(__dirname+'/lib/config');
      if (opts.http) {
        config.set('httpPort', Number(opts.http));
      }
      if (opts.https) {
        config.set('httpsPort', Number(opts.https));
      }
      if (opts.logDir) {
        config.set('logDir', opts.logDir);
      }
      if (opts.group) {
        config.set('gid', opts.group);
      }
      config.save(done);
    },

    function installService(done) {
      var cmd;
      write('Installing service');
      if (type==='systemd') {
        cmd='systemctl enable ood.service';
      } else {
        cmd='update-rc.d ood defaults';
      }
      exec(cmd, done);
    },

    function startService(done) {
      var cmd;
      write('Starting service');
      if (type==='systemd') {
        cmd='systemctl start ood';
      } else {
        cmd='/etc/init.d/ood start';
      }
      exec(cmd, function(err, stdout, stderr) {
        if (stderr) {
          process.stdout.write('failed!\n\n'+stderr);
          return;
        }
        done(err);
      });
    },

    function installAutocompleteBash(done) {
      write('Installing autocomplete for bash');
      fs.readFile(__dirname+'/templates/autocomplete.sh', function(err, data) {
        if (err) {
          return done(err);
        }
        fs.writeFile('/etc/bash_completion.d/ood', data, function(err) {
          process.stdout.write(err ? 'failed, skipping.' : 'ok!');
          done();
        });
      });
    },

    function installAutocompleteZSH(done) {
      write('Installing autocomplete for zsh', true);
      fs.readFile(__dirname+'/templates/autocomplete.sh', function(err, data) {
        if (err) {
          return done(err);
        }
        fs.writeFile('/usr/share/zsh/site-functions/ood', data, function(err) {
          process.stdout.write(err ? 'failed, skipping.' : 'ok!');
          done();
        });
      });
    },

    function logRotate(done) {
      write('Installing logrotate script', true);
      fs.readFile(__dirname+'/templates/logrotate', function(err, data) {
        if (err) {
          return done(err);
        }
        data=data.toString().replace('%LOGDIR%', opts.logDir || '/var/log/node');
        fs.writeFile('/etc/logrotate.d/ood', data, function(err) {
          process.stdout.write(err ? 'failed, skipping.' : 'ok!');
          done();
        });
      });
    }

  ], function(err) {
    if (err) {
      process.stdout.write('failed!\n\n'+(err.stack || err));
      return;
    }
    process.stdout.write('\n\n  Installation complete!\n\n');
  });
};

function write(msg, nook) {
  process.stdout.write((nook ? '' : 'ok!')+'\n  * '+msg+'... ');
}
