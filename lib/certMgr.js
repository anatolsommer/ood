/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module */
/* jshint strict:global, -W002 */

'use strict';

var fs=require('fs'), tls=require('tls'), EE=require('events').EventEmitter,
  Zocci=require('zocci'),  forge=require('node-forge'), util=require('./util'),
  log=util.logger('certMgr'), certMgr=new EE();

certMgr.getList=function(cb) {
  fs.readFile('/etc/ood/ssl.json', function(err, data) {
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
      if (!store.cert[cn].cert) {
        return;
      }
      ret.cert.push({
        cn:cn,
        altNames:store.cert[cn].altNames,
        expires:store.cert[cn].expires,
        ca:(store.ca ? store.ca[store.cert[cn].ca].cn : ''),
        caHash:store.cert[cn].ca
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
  fs.readFile('/etc/ood/ssl.json', function(err, data) {
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
        defaultCert=defaultCert || cert;
        ctx[cn]=tls.createSecureContext({
          key:cert.key,
          cert:cert.cert,
          ca:[store.ca[cert.ca]]
        });
      }
    });
    multi.forEach(function(alias) {
      ctx[alias[0]]=ctx[alias[1]];
    });
    cb(null, ctx, defaultCert);
  });
};

certMgr.import=function(files, password, cb) {
  var store=new Zocci('/etc/ood/ssl.json', {delimiter:':', fileMode:384}),
    res={errors:[], actions:[]}, cert, key, ca, first;
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
