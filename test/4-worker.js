var assert=require('assert'), cluster=require('cluster');

describe('worker', function() {

  it('should start worker', function(done) {
    cluster.isMaster=false;
    process.env.load_script=__dirname+'/apps/worker.js';
    global.workerRunningCallback=done;
    require('../lib/appContainer.js');
  });

});
