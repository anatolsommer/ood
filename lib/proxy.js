/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process */
/* jshint strict:global */

'use strict';

var httpProxy=require('http-proxy'), http=require('http'), https=require('https'),
  log=require('./util').parentLogger, proxy=httpProxy.createProxyServer({}),
  httpServer, httpsServer, config, hosts;

process.on('message', function(msg) {
  if (msg.cmd==='update') {
    if (!config) {
      config=msg.config;
      startServer();
      process.setgroups([]);
      try {
        process.setgid('nogroup');
      } catch(err) {
        process.setgid('nobody');
      }
      process.setuid('nobody');
    }
    hosts=msg.hosts;
    log.debug('Got update');
  }
});

function startServer() {
  var opts;
  httpServer=http.createServer(requestHandler);
  httpServer.listen(config.httpPort);
  if (config.ssl) {
    opts={};
    httpsServer=https.createServer(opts, requestHandler);
    httpsServer.listen(config.httpsPort);
  }
}

function requestHandler(req, res) {
  var host, proto;
  if (typeof req.headers.host==='string') {
    host=req.headers.host.split(':')[0].toLowerCase();
    if (hosts.redirect[host]) {
      proto=hosts.redirect[host].protocol;
      if (!proto || proto==='http') {
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

