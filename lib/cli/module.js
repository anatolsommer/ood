/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */
/* globals require,module,console */
/* jshint strict:global */

'use strict';

var zygon=require('zygon');

module.exports=function(api) {
  return function(opts) {
    if (opts.install) {
      console.log('\n  This may take a few seconds...');
      api('module', {install:opts.install}, function(err, res) {
        if (res.error) {
          console.error('  Error: '.bold.red+res.error+'\n');
        } else {
          console.log('  Module successfully installed!\n');
        }
      });
    } else if (opts.enable || opts.disable) {
      api('module', {enable:opts.enable, disable:opts.disable}, function(err, res) {
        if (res.error) {
          console.error('\n  Error: '.bold.red+res.error+'\n');
        } else {
          console.log('\n  Module '+(opts.enable ? 'enabled' : 'disabled')+'.\n');
        }
      });
    } else if (opts.list) {
      api('module', {list:true}, function(err, res) {
        if (res.error) {
          console.error('\n  Error: '.bold.red+res.error+'\n');
        } else {
          if (!res.list.length) {
            console.log('\n  There are no modules installed.\n');
            return;
          }
          zygon([
            {
              name:'Module name',
              key:'name',
              size:25
            }, {
              name:'Enabled',
              key:'enabled',
              size:8,
              format:function(enabled) {
                return enabled ? 'enabled' : 'disabled';
              },
              color:function(enabled) {
                return enabled ? 'green' : 'red';
              }
            }
          ], res.list);
        }
      });
    }
  };
};
