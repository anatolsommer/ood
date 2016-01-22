var fs=require('fs'), mkdirp=require('mkdirp'), exec=require('child_process').exec,
  destination='/etc/init.d/ood', template='ood-init.sh';

fs.readFile(__dirname+'/templates/'+template, prepareTemplate);

function prepareTemplate(err, tmpl) {
  if (err) {
    console.error('Could not load service template');
    return;
  }
  tmpl=tmpl.toString()
    .replace(/%NODE%/g, process.execPath)
    .replace(/%OOD%/g, __dirname+'/service');
  fs.writeFile(destination, tmpl, {mode:0755}, function(err) {
    if (err) {
      console.error('Could not write '+destination);
      return;
    }
    createEtcOod();
  });
}

function createEtcOod() {
  mkdirp('/etc/ood', {mode:0750}, function(err) {
    if (err) {
      console.error('Could not create /etc/ood');
      return;
    }
    installService();
  });
}

function installService() {
  exec('update-rc.d ood defaults', function(err) {
    if (err) {
      console.error('Could not install service');
      return;
    }
    startService();
  });
}

function startService() {
  exec('/etc/init.d/ood start', function(err, stdout, stderr) {
    if (err || stderr) {
      console.error('Could not start service\n'+stderr);
      return;
    }
    console.log('Installation complete, service running.');
  });
}
