/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var fs=require('fs'), mkdirp=require('mkdirp'), pidof=require('pidof'),
  exec=require('child_process').exec, type, destination, template;

pidof('systemd', function(err, pid) {
  if (pid) {
    type='systemd';
    destination='/etc/systemd/system/ood.service';
    template='ood.service';
  } else {
    destination='/etc/init.d/ood';
    template='ood-init.sh';
  }

  fs.readFile(__dirname+'/templates/'+template, prepareTemplate);
});

function prepareTemplate(err, tmpl) {
  if (err) {
    console.error('Could not load service template');
    return;
  }
  tmpl=tmpl.toString()
    .replace(/%NODE%/g, process.execPath)
    .replace(/%OOD%/g, __dirname+'/service');
  fs.writeFile(destination, tmpl, {mode:493}, function(err) {
    if (err) {
      console.error('Could not write '+destination);
      return;
    }
    createEtcOod();
  });
}

function createEtcOod() {
  mkdirp('/etc/ood', {mode:488}, function(err) {
    if (err) {
      console.error('Could not create /etc/ood');
      return;
    }
    installService();
  });
}

function installService() {
  var cmd;
  if (type==='systemd') {
    cmd='systemctl enable ood.service';
  } else {
    cmd='update-rc.d ood defaults';
  }
  exec(cmd, function(err) {
    if (err) {
      console.error('Could not install service');
      return;
    }
    startService();
  });
}

function startService() {
  var cmd;
  if (type==='systemd') {
    cmd='systemctl start ood';
  } else {
    cmd='/etc/init.d/ood start';
  }
  exec(cmd, function(err, stdout, stderr) {
    if (err || stderr) {
      console.error('Could not start service\n'+stderr);
      return;
    }
    console.log('Installation complete, service running.');
    installAutocomplete();
  });
}

function installAutocomplete() {
  var src=__dirname+'/templates/autocomplete.sh';
  fs.createReadStream(src)
    .pipe(fs.createWriteStream('/etc/bash_completion.d/ood'))
    .on('error', function() {});
  fs.createReadStream(src)
    .pipe(fs.createWriteStream('/usr/share/zsh/site-functions/ood'))
    .on('error', function() {});
}
