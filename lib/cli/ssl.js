/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module,console */
/* jshint strict:global */

'use strict';

var fs=require('fs'), zygon=require('zygon'), async=require('async');

module.exports=function(request) {
  return function() {
    var args=[].slice.call(arguments), opts=args.pop();

    if (opts.import) {
      args.unshift(opts.import);
      async.map(args, fs.readFile, function(err, data) {
        if (err) {
          return console.error('\n  Error: '.bold.red+err.message+'\n');
        }
        request('ssl', {import:data.map(String)}, function(res) {
          console.log();
          res.actions.forEach(function(msg) {
            console.log('  Success: '.green+msg);
          });
          res.errors.forEach(function(err) {
            var file=(typeof err.idx==='number' ? ' ('+args[err.idx].bold+')' : '');
            console.error('  Error: '.bold.red+err.msg+file);
          });
          console.log();
        });
      });
    } else if (opts.list) {
      request('ssl', {list:true}, function(res) {
        var issuers={}, tbl=zygon([
          {name:'Hostname', key:'cn', size:25},
          {name:'altNames', key:'altNames', size:25, format:function(arr) {
            return arr ? arr.join(','.grey) : '';
          }},
          {name:'Issuer', key:'ca', size:35},
          {name:'Expires', key:'expires', size:10}
        ]);

        tbl.printHead();
        tbl.printRows(res.cert);

        res.cert.forEach(function(cert) {
          issuers[cert.caHash]=(issuers[cert.caHash] || 0)+1;
        });

        zygon([
          {name:'CA Certificate', key:'cn', size:40},
          {name:'used', key:'hash', size:5, align:'right', format:function(hash) {
            return issuers[hash] ? issuers[hash]+'x'.grey : 'no'.red;
          }},
          {name:'Hash', key:'hash', size:40},
          {name:'Expires', key:'expires', size:10}
        ], res.ca);

      });
    } else if (opts.delete) {
      // TODO
      console.log('\n  Sorry, not implemented yet...\n');
    } else if (opts.deleteCa) {
      // TODO
      console.log('\n  Sorry, not implemented yet...\n');
    } else if (opts.auto) {
      if (opts.email && !opts.agree) {
        console.error('\n  You have to --agree if you supply an --email.\n');
        return;
      }
      console.log('\n  This may take a minute... please wait.');
      request('ssl', {
        auto:opts.auto,
        email:opts.email,
        agree:opts.agree
      }, function(res) {
        if (res.error) {
          console.error('  Error: '.bold.red+res.error+'\n');
        } else {
          console.log('  Success!\n'.green);
        }
      });
    }
  };
};
