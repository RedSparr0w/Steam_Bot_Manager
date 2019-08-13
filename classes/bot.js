var SteamUser = require('steam-user');
var Steam = SteamUser.Steam;
var SteamCommunity = require('steamcommunity');
var TradeOfferManager = require('steam-tradeoffer-manager');
var request = require('request');
var Cheerio = require('cheerio');

function dateTime(date = new Date()){
  const padNum = num => num.toString().padStart(2, 0);
  const dateStr = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(padNum).join('-');
  const timeStr = [date.getHours(), date.getMinutes(), date.getSeconds()].map(padNum).join(':');
  return `${dateStr} ${timeStr}`;
}

function log(botname, ...args) {
  console.log('%s', `[log][${dateTime()}][${botname}]`, ...args);
}

function info(botname, ...args) {
  console.info('%c%s', 'color:#3498db', `[info][${dateTime()}][${botname}]`, ...args);
}

function debug(botname, ...args) {
  console.debug('%c%s', 'color:#7f8c8d', `[debug][${dateTime()}][${botname}]`, ...args);
}

function warn(botname, ...args) {
  console.warn('%c%s', 'color:#f39c12', `[warn][${dateTime()}][${botname}]`, ...args);
}

function error(botname, ...args) {
  console.error('%c%s', 'color:#e74c3c', `[error][${dateTime()}][${botname}]`, ...args);
}

class Bot {
  constructor({
    nickname,
    username,
    password,
    shared_secret,
    identity_secret,
    state = 'Online',
  } = {}) {
    // "Private" fields
    if (!nickname || !username || !password)
      return throw Error('Must specify a nickname, username and password.');

    this.nickname = nickname;

    this.client = new SteamUser({"enablePicsCache": true, "promptSteamGuardCode": false});
  	this.manager = new TradeOfferManager({
  		steam: this.client, // Polling every 30 seconds is fine since we get notifications from Steam
  		domain: "redsparr0w.com", // Our domain is example.com
  		language: "en" // We want English item descriptions
  	});
  	this.community = new SteamCommunity();

    // Start the initial run
    this.login(username, password);
  }

  login(accountName, password){
  	return this.client.logOn({
      accountName,
      password,
    });
  }

  // Logging
  log(...args){
    log(this.nickname, ...args);
  }
  info(...args){
    info(this.nickname, ...args);
  }
  debug(...args){
    debug(this.nickname, ...args);
  }
  warn(...args){
    warn(this.nickname, ...args);
  }
  error(...args){
    error(this.nickname, ...args);
  }

  // define our getters and setters
  get interval_in_ms(){
    return this.__interval_in_ms;
  }

  set interval_in_ms(v){
    if (isNaN(+v)) return false;
    // Set interval, restart timeout
    this.__interval_in_ms = +v;
    this.start();
    return this.__interval_in_ms;
  }

  pause() {
    clearTimeout(this.__timeout);
    this.__running = false;
  }

  stop() {
    this.pause();
  }

  // Only getters no setters
  get running(){
    return this.__running;
  }
}
