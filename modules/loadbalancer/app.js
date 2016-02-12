var net=require('net'), api=require('../../lib/api-client');

exports.init=function(secret) {
  api.secret=secret;
  net.createServer(requestHandler).listen(79);
};

function requestHandler(conn) {
  var ok=0, fatal=0;

  api('config', {get:'maintenance'}, function(err, res) {
    if (err || res.value) {
      return conn.end('302 KO\n');
    }
    api.status(function(err, status) {
      if (err) {
        return conn.end('302 KO\n');
      }
      Object.keys(status).forEach(function(app) {
        var state=status[app].master.state;
        if (state==='fatal') {
          ++fatal;
        } else if (state==='running') {
          ++ok;
        }
      });
      conn.end(ok<fatal ? '302 KO\n' : '200 OK\n');
    });
  });
}
