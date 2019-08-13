const SteamUser = require('steam-user');
const Steam = SteamUser.Steam;
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const request = require('request');
const Cheerio = require('cheerio');
const fs = require('fs');
const gui = require('nw.gui'); //or global.window.nwDispatcher.requireNwGui() (see https://github.com/rogerwang/node-webkit/issues/707)

// Get the current window
const win = gui.Window.get();
const clipboard = gui.Clipboard.get();

const admin = {
	"steamID3" : "[U:1:16663071]",
	"accountID": "16663071",
	"steamID64": "76561197976928799"
}

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
    if (!nickname || !username || !password){
      throw Error('Must specify a nickname, username and password.');
      return;
    }

    this.nickname = nickname;
    this.state = state;

    // Start the initial run
    this.login(username, password);
  }

  login(accountName, password){
    if (this.client) return;
    this.client = new SteamUser({"enablePicsCache": true, "promptSteamGuardCode": false});
    this.manager = new TradeOfferManager({
      steam: this.client, // Polling every 30 seconds is fine since we get notifications from Steam
      domain: "redsparr0w.com", // Our domain is example.com
      language: "en" // We want English item descriptions
    });
    this.community = new SteamCommunity();

  	return this.client.logOn({
      accountName,
      password,
    });

    this.client.on('steamGuard', this.steamGuard);
    this.client.on('loggedOn', this.loggedOn);
    this.client.once('accountInfo', this.accountInfo);
    this.client.on('webSession', this.webSession);
    this.client.on('appOwnershipCached', this.appOwnershipCached);
    this.client.on('error', this.error);
    this.client.on('friendMessage', this.friendMessage);
    /*
    this.client.on('error', this.error);
    this.client.on('error', this.error);
    this.client.on('error', this.error);
    */
  }

  logOff(message = ''){
    this.info('Client logged off:', message);

		this.client.logOff();
		this.client.once('disconnected', this.removeClient);

		setTimeout(this.removeClient, 500);
	}

  removeClient(){
    delete this.client;
    delete this.manager;
    delete this.community;
    $('#' + this.nickname).remove();
  }

  /*
   *  CLIENT EVENTS - START
   */
  steamGuard(domain, callback, lastcode){
    if (domain){
      auth_msg = `[${this.nickname}]\n\nAuth Code\nEmailed to address *******@${domain}:`;
    } else if( this.shared_secret && !lastcode ){
      return callback(SteamUser.generateAuthCode(this.shared_secret));
    }else {
      auth_msg = `[${this.nickname}]\n\nMobile Auth code:`;
    }
    return callback(prompt(auth_msg));
  }

  loggedOn(){
 		this.client.setPersona(SteamUser.EPersonaState[this.state]);
 		this.client.setUIMode(1);
 		$(`#${this.nickname} .li-sub`).html('Logged into Steam!');
 		$(`#${this.nickname} .li-img img`).attr('class', 'online');
 		this.info('Logged into Steam!');
 		this.debug('Waiting for license info...');
 		this.debug('Client object:', this.client);
 	}

  accountInfo(displayName) {
    this.displayName = displayName;
		this.community.getSteamUser(this.client.steamID, (err,data)=>{
			this.avatar = `http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/5f/${data.avatarHash}_full.jpg`;
			$('#MultiAppsWindow').show().find('ul').append(`
        <li id="${this.nickname}">
          <div class="li-img">
            <img src="${this.avatar}" alt="${this.displayName}" />
          </div>
          <div class="li-text">
            <h4 class="li-head">${this.displayName}</h4>
            <p class="li-sub"></p>
          </div>
        </li>`);
			if(this.shared_secret){
				$(`#${this.nickname} img`).click(()=>{
					var AuthCode = SteamUser.generateAuthCode(this.shared_secret);
					clipboard.set(AuthCode);
					new Notification(`${this.displayName} Auth Code:`,{body: `${AuthCode} (copied to clipboard)`, icon: this.avatar}).onclick = function(){ this.close(); };
				});
			}
			$(`#${this.nickname} .li-img img`).attr('class', 'online');
			//Setup Bot Menu
			this.menu = new gui.Menu();

			const setStatusMenu = new gui.Menu();
			setStatusMenu.append(new gui.MenuItem({
				label: 'Online',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.Online);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Busy',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.Busy);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Away',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.Away);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Snooze',
				click: function() {
					this.client.setPersona(SteamUser.EPersonaState.Snooze);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Looking to Trade',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.LookingToTrade);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Looking to Play',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.LookingToPlay);
				}
			}));
			setStatusMenu.append(new gui.MenuItem({
				label: 'Offline',
				click: ()=>{
					this.client.setPersona(SteamUser.EPersonaState.Offline);
				}
			}));
			this.menu.append(new gui.MenuItem({
				label: 'Set Status',
				submenu: setStatusMenu
			}));
			this.menu.append(new gui.MenuItem({ type: 'separator' }));
			this.menu.append(new gui.MenuItem({
				label: 'Signout',
				click: ()=>{
					this.logOff('Context menu item clicked');
				}
			}));

			$(`#${this.nickname}`).on('contextmenu', (e)=>{
				e.preventDefault();
				this.menu.popup(e.pageX, e.pageY);
				return false;
			});
		});
	}

  webSession(sessionID, cookies){
		this.manager.setCookies(cookies, err=>{
			if (!err) return;
      // We probably couldn't get our API key
			this.error(err);
			return this.logOff('webSession error');
		});
		this.community.setCookies(cookies);
    if (this.identity_secret){
      // Auto check and accept confirmations every 30 seconds
		  this.community.startConfirmationChecker(30000, this.identity_secret);
    }
	}

  appOwnershipCached(){
		this.debug('Got app ownership info');
		this.client.setPersona(SteamUser.EPersonaState[this.state]);
		this.checkMinPlaytime(true);
	}

  error(err) {
		$(`#${this.nickname} .li-img img`).attr('class', 'offline');
		this.error(e.message + '\n', e);
		if (e.message == 'LoggedInElsewhere' || e.message == 'LogonSessionReplaced'){
			$(`#${this.nickname} .li-sub`).html('In Game Elsewhere!');
		}else{
			$(`#${this.nickname} .li-sub`).html('Offline!');
		}
	}

  friendMessage(steamID, message){
		if (/^[\d\w]{2,5}(\-[\d\w]{4,5}){2,4}$/.test(message)){
      // Steam Key to be redeemed
			this.client.redeemKey(message, (result, details, packages)=>{
				const games = [];

				$.each(packages,function(appID, appName){
					games.push(`[${appID}] ${appName}`);
				});

				if (result==1){
					this.client.chatMessage(steamID, `[${this.nickname}] Successfully activated:\n${games.join('\n')}`);
					this.checkMinPlaytime(true);
				}else{
					this.client.chatMessage(steamID, `[${this.nickname}] Failed to activate:\n${games.join('\n')}`);
				}
			});
		}else{
			this.community.getSteamUser(steamID, (err, otherUser)=>{
				new Notification(`${otherUser.name} → ${this.nickname}`, {body: message, icon: `http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/5f/${otherUser.avatarHash}_full.jpg`}).onclick = function(){ this.close(); };
			});
		}
	}
  /*
   *  CLIENT EVENTS - END
   */

  checkMinPlaytime(reset_pages = false){
    if (reset_pages){
      this.current_page = 1;
    }
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

  // Only getters no setters
  get running(){
    return this.__running;
  }
}

module.exports = Bot;
