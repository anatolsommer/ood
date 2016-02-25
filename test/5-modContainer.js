var assert=require('assert'), fork=require('child_process').fork;

describe('modContainer', function() {
  var cont;

  this.timeout(2500);
  this._slow=2100;

  it('should fork a modContainer', function(done) {
    cont=fork(
      __dirname+'/../node_modules/istanbul/lib/cli.js',
      [
        'cover',
        __dirname+'/../lib/modContainer.js',
        '--dir',
        __dirname+'/../coverage/modContainer'
      ],
      {env:{OOD_TEST:true}, silent:true}
    );
    assert(cont);
    setTimeout(done, 1000);
  });

  //TODO

  it('should kill the modContainer', function(done) {
    cont.send({cmd:'unload'});
    cont.on('exit', done);
  });

});
