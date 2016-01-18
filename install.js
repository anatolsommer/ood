var fs=require('fs'), exec=require('child_process').exec;

fs.readFile(__dirname+'/templates/ood-init.sh', prepareTemplate);

function prepareTemplate(err, tmpl) {
  if (err) {
    console.error('Could not load service template');
    return;
  }
  tmpl=tmpl.toString()
    .replace(/%NODE%/g, process.execPath)
    .replace(/%OOD%/g, __dirname+'/service');
  fs.writeFile('/etc/init.d/ood', tmpl, {mode:0755}, function(err) {
    if (err) {
      console.error('Could not write /etc/init.d/ood');
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
