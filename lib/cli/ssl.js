/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var fs=require('fs'), zygon=require('zygon'), async=require('async');

module.exports=function(api) {
  return function() {
    var args=[].slice.call(arguments), opts=args.pop();

    if (opts.import) {
      args.unshift(opts.import);
      async.map(args, fs.readFile, function(err, data) {
        if (err) {
          return console.error('\n  Error: '.bold.red+err.message+'\n');
        }
        api('ssl', {import:data.map(String)}, function(err, res) {
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
      api.ssl.list(function(err, list) {
        var issuers={}, tbl=zygon([
          {name:'Hostname', key:'cn', size:25},
          {name:'altNames', key:'altNames', size:25, format:function(arr) {
            return arr ? arr.join(','.grey) : '';
          }},
          {name:'Issuer', key:'ca', size:35, format:function(ca) {
            return ca || 'CA certificate not found'.red;
          }},
          {name:'Expires', key:'expires', size:10}
        ]);

        tbl.printHead();
        tbl.printRows(list.cert);

        list.cert.forEach(function(cert) {
          issuers[cert.caHash]=(issuers[cert.caHash] || 0)+1;
        });

        zygon([
          {name:'CA Certificate', key:'cn', size:40},
          {name:'used', key:'hash', size:5, align:'right', format:function(hash) {
            return issuers[hash] ? issuers[hash]+'x'.grey : 'no'.red;
          }},
          {name:'Hash', key:'hash', size:40},
          {name:'Expires', key:'expires', size:10}
        ], list.ca);
      });

    } else if (opts.delete || opts.deleteCa) {
      api.ssl[opts.delete ? 'deleteCert' : 'deleteCa'](
        opts.delete || opts.deleteCa,
        function() {
          console.log('\n  Success!\n'.green);
        }
      );

    } else if (opts.auto) {
      if (opts.email && !opts.agree) {
        console.error('\n  You have to --agree if you supply an --email.\n');
        return;
      }
      console.log('\n  This may take a minute... please wait.');
      api.ssl.auto(opts.auto, opts.email, opts.agree, function() {
        console.log('  Success!\n'.green);
      });
    }
  };
};
