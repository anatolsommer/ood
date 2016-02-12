/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process */
/* jshint strict:global */

'use strict';

var http=require('http'), https=require('https'), fs=require('fs'),
  httpProxy=require('http-proxy'), util=require('./util'), log=util.parentLogger,
  certMgr=require('./certMgr'), tmp=require('os').tmpdir(), noop=function() {},
  acmeExp=/^\/\.well-known\/acme-challenge\/([\w-]{43})$/,
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
  var host, proto, match, modPath;
  if (req.url[1]==='.') {
    if ((match=req.url.match(/^\/\.(ood[\w-_]+)/))) {
      modPath=match[1];
      match=req.url.match(/[&?]token=(\w{32})/);
      // TODO: module system
      if (modPath==='ood-monitoring') {
        if (!match || config.token!==match[1]) {
          res.statusCode=403;
          res.end();
        }
        proxy.web(req, res, {
          target:{
            host:'127.0.0.1',
            port:8990
          }
        });
      } else {
        res.statusCode=404;
        res.end();
      }
      return;
    } else if ((match=req.url.match(acmeExp))) {
      fs.readFile(
        tmp+'/.well-known/acme-challenge/'+match[1],
        function(err, data) {
          if (err) {
            res.statusCode=404;
          } else {
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
