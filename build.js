var NwBuilder = require('nw-builder');
var nw = new NwBuilder({
    files: ['./**','!./bots.json','!./node_modules/nw-builder/**','!./Steam_Bot_Manager/**'], // use the glob format
    platforms: ['win32', 'win64'],
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