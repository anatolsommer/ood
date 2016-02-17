/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var fs=require('fs'), os=require('os'), tls=require('tls'), EE=require('events'),
  mkdirp=require('mkdirp'), Zocci=require('zocci'), letiny=require('letiny'),
  forge=require('node-forge'), util=require('./util'), log=util.logger('certMgr'),
  certMgr=new EE(), OOD_DIR=process.env.OOD_DIR || '/etc/ood', store;

certMgr.initStore=function() {
  store=store || new Zocci(OOD_DIR+'/ssl.json', {delimiter:':', fileMode:384});
};

certMgr.getList=function(cb) {
  fs.readFile(OOD_DIR+'/ssl.json', function(err, data) {
    var ret={cert:[], ca:[]}, store;
    if (err) {
      return cb(err);
    }
    try {
      store=JSON.parse(data.toString());
    } catch(err) {
      return cb(err);
    }
    Object.keys(store.cert || {}).forEach(function(cn) {
      var ca;
      if (!store.cert[cn].cert) {
        return;
      }
      ca=store.cert[cn].ca;
      ret.cert.push({
        cn:cn,
        altNames:store.cert[cn].altNames,
        expires:store.cert[cn].expires,
        ca:(store.ca && store.ca[ca] ? store.ca[ca].cn : ''),
        caHash:ca
      });
    });
    Object.keys(store.ca || {}).forEach(function(hash) {
      ret.ca.push({
        cn:store.ca[hash].cn,
        hash:hash,
        expires:store.ca[hash].expires
      });
    });
    cb(null, ret);
  });
};

certMgr.getSSLContexts=function(cb) {
  fs.readFile(OOD_DIR+'/ssl.json', function(err, data) {
    var multi=[], ctx={}, store, defaultCert;
    if (err) {
      return cb(err);
    }
    try {
      store=JSON.parse(data.toString());
    } catch(err) {
      return cb(err);
    }
    if (!store.cert) {
      return cb(null, {});
    }
    Object.keys(store.cert).forEach(function(cn) {
      var cert=store.cert[cn];
      if (cert.altNameOf) {
        multi.push([cn, cert.altNameOf]);
      } else {
        cert.ca=[store.ca[cert.ca].pem];
        defaultCert=defaultCert || cert;
        ctx[cn]=tls.createSecureContext({
          key:cert.key,
          cert:cert.cert,
          ca:cert.ca
        });
      }
    });
    multi.forEach(function(alias) {
      ctx[alias[0]]=ctx[alias[1]];
    });
    cb(null, ctx, defaultCert);
  });
};

certMgr.autoSSL=function(domains, email, cb) {
  var account, privateKey;
  certMgr.initStore();
  account=store.get('account') || {};
  privateKey=store.get('cert:'+domains[0]+':key');
  if (!account.key && !email) {
    cb(new Error('Account not found and no email supplied.'));
    return;
  }
  letiny.getCert({
    email:email || account.email,
    domains:domains,
    challenge:saveChallenge,
    accountKey:account.key,
    privateKey:privateKey,
    agreeTerms:true,
    url:(process.env.OOD_TEST ? 'http://127.0.0.1:7357' : null)
  }, function(err, cert, key, ca, accountKey) {
    if (!account.key && accountKey) {
      store.set('account', {key:accountKey, email:email});
    }
    if (err) {
      cb(err);
      return;
    }
    certMgr.import([cert, key, ca], function(result) {
      if (result.errors.length) {
        cb(result.errors);
        return;
      }
      store.set('auto:'+domains[0], domains, cb);
    });
  });
};

certMgr.autoRenew=function() {
  var list, DAYS=86400000;
  certMgr.initStore();
  list=store.get('auto') || {};
  list=Object.keys(list).map(function(domain) {
    return list[domain];
  });
  nextDomain();

  function nextDomain() {
    var domains=list.shift(), cert;
    if (!domains) {
      return;
    }
    cert=store.get('cert:'+domains[0]);
    if ((new Date(cert.expires)-new Date())<15*DAYS) {
      letiny.getCert({
        domains:domains,
        challenge:saveChallenge,
        privateKey:cert.key,
        account:store.get('account:key'),
        email:store.get('account:email'),
        agreeTerms:true,
        url:(process.env.OOD_TEST ? 'http://127.0.0.1:7357' : null)
      }, function(err, cert, key, ca) {
        if (err) {
          log.error(
            'Could not renew certificate',
            {domains:domains, error:err.message}
          );
          return nextDomain();
        }
        certMgr.import([cert, key, ca], function(result) {
          if (result.errors.length) {
            log.error(
              'Could not import renewed certificate',
              {domains:domains, errors:result.errors}
            );
          }
          nextDomain();
        });
      });
    } else {
      nextDomain();
    }
  }
};

certMgr.import=function(files, password, cb) {
  var res={errors:[], actions:[]}, cert, key, ca, first;
  certMgr.initStore();
  if (!cb) {
    cb=password;
    password='';
  }
  first=(!store.get('cert') || Object.keys(store.get('cert'))===0);
  files.forEach(function(file, i) {
    var type=getType(file), parsed;
    try {
      if (type==='x509') {
        parsed=forge.pki.certificateFromPem(file);
      } else if (type==='rsakey') {
        parsed=forge.pki.privateKeyFromPem(file);
      } else if (type==='pkcs12') {
        parsed=forge.util.decode64(file);
        parsed=forge.asn1.fromDer(parsed);
        parsed=forge.pkcs12.pkcs12FromAsn1(parsed, password);
        parsed=parsed.safeContents;
        throw new Error('Sorry, PKCS#12 is not supported yet');
      }
      if (!parsed) {
        throw new Error('Unknown format');
      }
      if (type==='rsakey') {
        key=file;
      } else {
        if (parsed.getExtension('basicConstraints').cA) {
          ca={
            hash:parsed.subject.hash,
            cn:parsed.subject.getField('CN').value,
            pem:file,
            expires:parsed.validity.notAfter.toJSON().substr(0, 10)
          };
        } else {
          cert={
            cn:parsed.subject.getField('CN').value,
            altNames:parsed.getExtension('subjectAltName').altNames,
            pem:file,
            ca:parsed.issuer.hash,
            expires:parsed.validity.notAfter.toJSON().substr(0, 10)
          };
        }
      }
    } catch(err) {
      res.errors.push({idx:i, msg:err.message});
    }
  });
  if (cert && key) {
    store.set('cert:'+cert.cn, {
      cert:cert.pem,
      key:key,
      ca:cert.ca,
      expires:cert.expires,
      altNames:cert.altNames.map(function(altName) {
        return altName.value;
      }).filter(function(altName) {
        return altName!==cert.cn;
      })
    });
    cert.altNames.forEach(function(altName) {
      altName=altName.value;
      if (altName!==cert.cn) {
        store.set('cert:'+altName, {altNameOf:cert.cn});
      }
    });
    res.actions.push('Imported certificate with CN='+cert.cn);
    log.info('Imported certificate', {cn:cert.cn, issuer:cert.ca});
  } else if (cert) {
    res.errors.push({msg:'Missing private key for certificate with CN='+cert.cn});
  } else if (key) {
    res.errors.push({msg:'Found private key but no certificate'});
  }
  if (ca) {
    store.set('ca:'+ca.hash, {
      cn:ca.cn,
      pem:ca.pem,
      expires:ca.expires
    });
    res.actions.push('Imported CA certificate with CN='+ca.cn);
    log.info('Imported CA certificate', {cn:ca.cn, hash:ca.hash});
  }
  store.save(function(err) {
    if (err) {
      res.errors.push({msg:err.message});
    } else {
      certMgr.emit('import', cert, ca, first);
    }
    cb(res);
  });
};

certMgr.deleteCert=function(cn, cb) {
  if (!store.get('cert:'+cn)) {
    return cb(new Error('Certificate not found'));
  }
  store.remove('cert:'+cn, cb);
};

certMgr.deleteCa=function(hash, cb) {
  if (!store.get('ca:'+hash)) {
    return cb(new Error('CA certificate not found'));
  }
  store.remove('ca:'+hash, cb);
};

function saveChallenge(domain, path, data, done) {
  var tmp=os.tmpdir();
  mkdirp(tmp+'/.well-known/acme-challenge', {mode:511}, function(err) {
    fs.writeFile(tmp+path, data, {mode:511}, function(err) {
      done();
      setTimeout(function() {
        fs.unlink(tmp+path);
      }, 10000);
    });
  });
}

function getType(file) {
  if (~file.indexOf('CERTIFICATE')) {
    return 'x509';
  } else if (~file.indexOf('PRIVATE KEY')) {
    return 'rsakey';
  } else if (file.match(/^[\w+\/=]+$/)) {
    return 'pkcs12';
  }
}

module.exports=certMgr;
