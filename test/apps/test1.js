process.send({type:'log', level:'debug', args:{'0':'Hi!'}});

console.log('boo');

if (process.env.crash && process.env.crash>Date.now()) {
  throw 'bye';
}

process.on('message', function(msg) {
  if (msg==='crash') {
    throw 'ooops';
  }
});
