/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,process */
/* jshint strict:global */

'use strict';

var httpProxy=require('http-proxy'), http=require('http'),
  log=require('./util').parentLogger, proxy=httpProxy.createProxyServer({}),
  httpServer, httpsServer, config, hosts;

httpServer=http.createServer(function(req, res) {
  var host;
  if (typeof req.headers.host==='string') {
    host=req.headers.host.split(':')[0];
    if (hosts.app[host]) {
      proxy.web(req, res, {
        target:{
          host:'127.0.0.1',
          port:hosts.app[host]
        }
      });
      return;
    /*} else if (hosts.redirect[host]) {
      res.writeHead(302, { 'Location': hosts.redirect[host] });
      res.end();
      return;*/
    }
  }
  res.end('Not found: '+(req.headers.host || 'no hostname'));
});

process.on('message', function(msg) {
  if (msg.cmd==='update') {
    if (!config) {
      config=msg.config;
      httpServer.listen(config.httpPort);
      process.setgroups([]);
      process.setgid('nogroup');
      process.setuid('nobody');
    }
    hosts=msg.hosts;
    log.debug('Got update');
  }
});
