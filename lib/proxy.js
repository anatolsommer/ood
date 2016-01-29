/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process */
/* jshint strict:global */

'use strict';

var http=require('http'), https=require('https'), httpProxy=require('http-proxy'),
  util=require('./util'), certMgr=require('./certMgr'), log=util.parentLogger,
  noop=function() {}, proxy, httpServer, httpsServer, config, hosts, sslCtx;

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
    log.debug('Refreshing SSL contexts');
    getSSLContexts();
  }
});

function startServer() {
  proxy=httpProxy.createProxyServer({});

  httpServer=http.createServer(requestHandler);
  httpServer.listen(config.httpPort);

  getSSLContexts(function(err, opts) {
    if (opts) {
      opts.SNICallback=sniCallback;
      httpsServer=https.createServer(opts, requestHandler);
      httpsServer.listen(config.httpsPort);
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
  var host, proto;
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
      proxy.web(req, res, {
        target:{
          host:'127.0.0.1',
          port:hosts.app[host]
        }
      });
      return;
    }
  }
  res.end('Not found: '+(req.headers.host || 'no hostname'));
}

function sniCallback(hostname, cb) {
  if (sslCtx && sslCtx.hasOwnProperty(hostname)) {
    cb(null, sslCtx[hostname]);
  } else {
   cb(new Error('Cert not found'));
  }
}
