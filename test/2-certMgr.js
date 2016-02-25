var assert=require('assert'), fs=require('fs'), http=require('http'),
  forge=require('node-forge'), certMgr;

describe('certMgr', function() {
  this._slow=1000;

  it('should require certMgr', function() {
    process.env.OOD_DIR=__dirname+'/etc_ood';
    process.env.OOD_TEST=true;
    certMgr=require(__dirname+'/../lib/certMgr.js');
  });

  it('autoRenew should do nothing', function(done) {
    certMgr.autoRenew();
    setTimeout(done, 100);
  });

  it('store should be empty', function(done) {
    certMgr.getList(function(err, list) {
      assert(!err);
      assert(list);
      assert.equal(list.cert.length, 0);
      assert.equal(list.ca.length, 0);
      done();
    });
  });

  it('should return empty SSL contexts', function(done) {
    certMgr.getSSLContexts(function(err, data) {
      assert(!err);
      assert(data);
      assert.equal(Object.keys(data).length, 0);
      done();
    });
  });

  describe('import', function() {
    var key, cert, ca;

    before(function() {
      key=fs.readFileSync(__dirname+'/fakecerts/key.pem').toString();
      cert=fs.readFileSync(__dirname+'/fakecerts/cert.pem').toString();
      ca=fs.readFileSync(__dirname+'/fakecerts/ca.pem').toString();
    });

    it('should cb with err on invalid input', function(done) {
      certMgr.import([':)'], null, function(result) {
        assert.equal(result.errors.length, 1);
        assert.equal(result.actions.length, 0);
        done();
      });
    });

    it('should cb with err if key is missing', function(done) {
      certMgr.import([cert], null, function(result) {
        assert.equal(result.errors.length, 1);
        assert.equal(result.actions.length, 0);
        done();
      });
    });

    it('should cb with err if cert is missing', function(done) {
      certMgr.import([key], null, function(result) {
        assert.equal(result.errors.length, 1);
        assert.equal(result.actions.length, 0);
        done();
      });
    });

    it('should import ca', function(done) {
      silence(true);
      certMgr.import([ca], null, function(result) {
        silence(false);
        assert.equal(result.errors.length, 0);
        assert.equal(result.actions.length, 1);
        done();
      });
    });

    it('should import key, cert and ca', function(done) {
      silence(true);
      certMgr.import([key, cert, ca], null, function(result) {
        silence(false);
        assert.equal(result.errors.length, 0);
        assert.equal(result.actions.length, 2);
        done();
      });
    });
  });

  describe('list', function() {
    it('should return list with cert and ca cert', function(done) {
      certMgr.getList(function(err, list) {
        assert(!err);
        assert(list);
        assert.equal(list.cert.length, 1);
        assert.equal(list.ca.length, 1);
        done();
      });
    });
  });

  describe('getSSLContexts', function() {
    it('should return SSL contexts', function(done) {
      certMgr.getSSLContexts(function(err, data) {
        assert(!err);
        assert(data);
        assert(data['oodjs.org']);
        assert(data['www.oodjs.org']);
        done();
      });
    });
  });

  describe('autoSSL', function() {
    var fakeAcme;

    this.timeout(20000);
    this._slow=15000;

    before(function() {
      fakeAcme=http.createServer(fakeAcmeHandler);
      fakeAcme.listen(7357, '127.0.0.1');
    });

    it('should cb with err if no email was provided', function(done) {
      certMgr.autoSSL([], null, function(err, data) {
        assert(err);
        assert(!data);
        done();
      });
    });

    it('should obtain cert from fake acme server', function(done) {
      silence(true);
      certMgr.autoSSL('example.com', 'me@example.com', function(err) {
        silence(false);
        assert(!err);
        done();
      });
    });

    after(function() {
      fakeAcme.close();
    });
  });

  after(function() {
    fs.unlinkSync(__dirname+'/etc_ood/ssl.json');
  });
});

function fakeAcmeHandler(req, res) {
  if (req.url==='/directory') {
    res.writeHead(200);
    res.write(JSON.stringify({
      "new-authz":"http://127.0.0.1:7357/acme/new-authz",
      "new-cert":"http://127.0.0.1:7357/acme/new-cert",
      "new-reg":"http://127.0.0.1:7357/acme/new-reg"
    }));
    res.end();
  } else if (req.url==='/acme/new-reg') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'location':'http://127.0.0.1:7357/agree',
      'link':'<http://127.0.0.1:7357/foo>;rel="next",'+
        '<http://127.0.0.1:7357/foo>;rel="terms-of-service"'
    });
    res.end();
  } else if (req.url==='/acme/new-authz') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'link':'<http://127.0.0.1:7357/getcert>;rel="next"',
    });
    res.write(JSON.stringify({
      challenges:[{
        type:'http-01',
        token:'bar',
        uri:'http://127.0.0.1:7357/verify'
      }]
    }));
    res.end();
  } else if (req.url==='/agree') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'link':'<http://127.0.0.1:7357/foo>;rel="next"'
    });
    res.write(JSON.stringify({}));
    res.end();
  } else if (req.url==='/verify') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'link':'<http://127.0.0.1:7357/foo>;rel="next"'
    });
    res.write(JSON.stringify({status:'valid'}));
    res.end();
  } else if (req.url==='/getcert') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'location':'http://127.0.0.1:7357/getcert',
      'link':'<http://127.0.0.1:7357/cacert>;rel="up"'
    });
    res.write(loadCert(__dirname+'/fakecerts/cert.pem'));
    res.end();
  } else if (req.url==='/cacert') {
    res.writeHead(200, {
      'replay-nonce':'foo',
      'location':'http://127.0.0.1:7357/getcert',
      'link':'<http://127.0.0.1:7357/getcert>;rel="up"'
    });
    res.write(loadCert(__dirname+'/fakecerts/ca.pem'));
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
}

function loadCert(file) {
  var cert=fs.readFileSync(file).toString();
  cert=cert.replace('-----BEGIN CERTIFICATE-----', '');
  cert=cert.replace('-----END CERTIFICATE-----', '');
  cert=cert.replace(/\n/g, '');
  cert=cert.replace(/[+]/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return new Buffer(cert, 'base64');
}

function silence(on) {
  silence.write=silence.write || process.stdout.write;
  process.stdout.write=(on ? function() {} : silence.write);
}
