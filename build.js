var NwBuilder = require('nw-builder');
var nw = new NwBuilder({
  files: ['./**','!./bots.json','!./node_modules/nw-builder/**','!./cache/**'], // use the glob format
  platforms: [ 'win'],
  buildDir: "../builds",
  winIco: "./logo.ico",
  zip: false
});

//Log stuff you want
nw.on('log',  console.log);

// Build returns a promise
nw.build().then(function () {
  console.log('Build Complete!');
}).catch(function (error) {
  console.error(error);
});