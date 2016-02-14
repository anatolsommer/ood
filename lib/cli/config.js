/*!
 * ood
 * Copyright(c) 2015-2016 Anatol Sommer <anatol@anatol.at>
 * MIT Licensed
 */

'use strict';

var teselecta=require('teselecta');

module.exports=function(api) {
  return function(val, opts) {
    var change;
    if (!opts) {
      opts=val;
      val=null;
    }
    change={app:opts.app};
    if (opts.delete) {
      change.delete=opts.delete;
    } else if (opts.get) {
      change.get=(opts.get===true ? '' : opts.get);
    } else if (opts.set) {
      change.set=opts.set;
      change.value=val;
    }
    api('config', change, function(err, res) {
      var val;
      if (err) {
        throw err;
      } else if (res.error) {
        throw new Error(res.error);
      }
      if (opts.get) {
        val=teselecta(res.value, {
          prepend:(typeof opts.get==='string' ? opts.get.bold+': ' : ''),
          spacing:2
        });
        console.log('\n'+val+'\n');
      } else {
        console.log('\n  Success!\n'.green);
      }
    });
  };
};
