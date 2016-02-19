/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var http=require('http'), https=require('https'), fs=require('fs'),
  httpProxy=require('http-proxy'), util=require('./util'), log=util.parentLogger,
  certMgr=require('./certMgr'), tmp=require('os').tmpdir(), noop=function() {},
  acmeExp=/^\/\.well-known\/acme-challenge\/([\w-]{43})$/, wildcardExp=/^[^\.]+/,
  proxy, httpServer, httpsServer, config, hosts, sslCtx;

process.on('message', function(msg) {
  if (msg.cmd==='update') {
    if (!config) {
      config=msg.config;
      startServer();
      util.setGid();
      process.setuid('nobody');
    }
    hosts=msg.hosts;
    log.debug('Got update');
  } else if (msg.cmd==='refreshssl') {
    getSSLContexts();
    log.debug('Refreshed SSL contexts');
  }
});

function startServer() {
  proxy=httpProxy.createProxyServer({});
  proxy.on('proxyRes', accessLog);
  proxy.on('error', function(err, req, res) {
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('Error'); // TODO: error pages
    appLog('Proxy error: '+err.message, req, true);
  });

  httpServer=http.createServer(requestHandler);
  httpServer.listen(config.httpPort, '0.0.0.0');

  getSSLContexts(function(err, opts) {
    if (opts) {
      opts.SNICallback=sniCallback;
      httpsServer=https.createServer(opts, requestHandler);
      httpsServer.listen(config.httpsPort, '0.0.0.0');
    }
  });
}

function getSSLContexts(cb) {
  cb=cb || noop;
  certMgr.getSSLContexts(function(err, ctx, defaultCert) {
    if (err || !defaultCert) {
      return cb(err);
    }
    sslCtx=ctx;
    cb(err, defaultCert);
  });
}

function requestHandler(req, res) {
  var host, proto, match, modPath;
  if (req.url[1]==='.') {
    if ((match=req.url.match(/^\/\.(ood[\w-_]+)/))) {
      modPath=match[1];
      match=req.url.match(/[&?]token=(\w{32})/);
      if (hosts.mod[modPath]) {
        if (!match || config.token!==match[1]) {
          appLog('Unauthenticated request for module: '+modPath, req, true);
          res.statusCode=403;
          res.end();
          return;
        }
        req.modName=hosts.mod[modPath].modName;
        proxy.web(req, res, {
          target:{
            host:'127.0.0.1',
            port:hosts.mod[modPath].port
          }
        });
      } else {
        appLog('Request for unknown module: '+modPath, req, true);
        res.statusCode=404;
        res.end();
      }
      return;
    } else if ((match=req.url.match(acmeExp))) {
      log.debug('Got acme challange request');
      fs.readFile(
        tmp+'/.well-known/acme-challenge/'+match[1],
        function(err, data) {
          if (err) {
            res.statusCode=404;
            appLog('Acme challange file not found', req, true);
          } else {
            appLog('Serving acme challange', req);
            res.write(data);
          }
          res.end();
        }
      );
      return;
    }
  }
  if (typeof req.headers.host==='string') {
    host=req.headers.host.split(':')[0].toLowerCase();
    if (hosts.redirect[host]) {
      proto=hosts.redirect[host].protocol;
      if (!proto || proto==='http'+(req.connection.encrypted ? 's' : '')) {
        res.writeHead(302, { 'Location': hosts.redirect[host].target });
        res.end();
        return;
      }
    }
    if (hosts.app[host]) {
      req.appName=hosts.app[host].appName;
      proxy.web(req, res, {
        target:{
          host:'127.0.0.1',
          port:hosts.app[host].port
        }
      });
      return;
    }
  }
  appLog('Request for unknown hostname', req);
  res.statusCode=404;
  res.end('Not found: '+(req.headers.host || 'no hostname'));
}

function sniCallback(hostname, cb) {
  if (sslCtx) {
    if (sslCtx.hasOwnProperty(hostname)) {
      return cb(null, sslCtx[hostname]);
    } else if (hostname[0]!=='*') {
      return sniCallback(hostname.replace(wildcardExp, '*'), cb);
    }
  }
  cb(new Error('Cert not found'));
}

function appLog(msg, req, error) {
  console[error ? 'error' : 'log'](JSON.stringify({
    msg:msg,
    method:req.method,
    url:req.url,
    host:req.headers.host,
    remoteIP:req.connection.remoteAddress
  }));
}

function accessLog(proxyRes, req, res) {
  var ip, len, head;
  ip=req.connection.remoteAddress;
  len=proxyRes.headers['content-length'] || 0;
  head=req.method+' '+req.url+' HTTP/'+req.httpVersion;
  process.send({
    type:'accessLog',
    app:req.appName,
    mod:req.modName,
    log:ip+' - - '+clfDate()+' "'+head+'" '+proxyRes.statusCode+' '+len
  });
}

function clfDate() {
  var date=new Date().toUTCString().split(' ');
  return '['+date[1]+'/'+date[2]+'/'+date[3]+':'+date[4]+' +0000]';
}
