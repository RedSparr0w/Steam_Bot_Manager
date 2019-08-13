/*
global.gui = require('nw.gui');
global.console = console;
const gui = global.gui;

// all bots
const bots = require('./bots.js');
const Bot = require('./classes/Bot.js');
//*/

// all bots
const bots = require('./bots.js');

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

    this.username = username;
    this.password = password;
    this.nickname = nickname;
    if (shared_secret) this.shared_secret = shared_secret;
    if (identity_secret) this.shared_secret = identity_secret;
    this.state = state;
    this.current_page = 1;

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

    this.debug('Logging in..');

    this.client.logOn({
      accountName,
      password,
    });

    this.client.on('error', (...args)=>this.clientError(...args));
    this.client.on('steamGuard', (...args)=>this.steamGuard(...args));
    this.client.on('loggedOn', (...args)=>this.loggedOn(...args));
    this.client.once('accountInfo', (...args)=>this.accountInfo(...args));
    this.client.on('webSession', (...args)=>this.webSession(...args));
    this.client.on('appOwnershipCached', (...args)=>this.appOwnershipCached(...args));
    this.client.on('friendMessage', (...args)=>this.friendMessage(...args));
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
    if (!this.client) return;
    this.debug('Steam client objects removed');
    delete this.client;
    delete this.manager;
    delete this.community;
    $(`#${this.nickname}`).remove();
  }

  /*
   *  CLIENT EVENTS - START
   */
  steamGuard(domain, callback, lastcode){
    if (domain){
      auth_msg = `[${this.nickname}]\n\nAuth Code\nEmailed to address *******@${domain}:`;
    } else if( this.shared_secret && !lastcode ){
      this.debug('Attempt login with generated steam guard code');
      callback(SteamUser.generateAuthCode(this.shared_secret));
      return;
    } else {
      auth_msg = `[${this.nickname}]\n\nMobile Auth code:`;
    }
    this.debug('Awaiting steam guard code:\n', auth_msg);
    callback(global.window.prompt(auth_msg));
  }

  loggedOn(){
    this.info('Logged into Steam!');
    this.client.setPersona(SteamUser.EPersonaState[this.state]);
    this.client.setUIMode(1);
    $(`#${this.nickname} .li-sub`).html('Logged into Steam!');
    $(`#${this.nickname} .li-img img`).attr('class', 'online');
    this.debug('Waiting for license info...');
    this.debug('Steam client object:', this.client);
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

  clientError(e){
    $(`#${this.nickname} .li-img img`).attr('class', 'offline');
    this.error(e.message + '\n', e);
    if (e.message == 'LoggedInElsewhere' || e.message == 'LogonSessionReplaced'){
      return $(`#${this.nickname} .li-sub`).html('In Game Elsewhere!');
    }
    if (e.message == 'RateLimitExceeded'){
      this.logOff('RateLimitExceeded\nToo many login attempts!\nTry again soon..');
      return $(`#${this.nickname} .li-sub`).html('Too many login attempts!\nTry again soon..');
    }
    $(`#${this.nickname} .li-sub`).html('Offline!');
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

/*
const newBot = function(bot,v){
  v.g_Jar = request.jar();
  v.request = request.defaults({"jar": v.g_Jar});
  v.g_Page = 1;
  v.g_CheckTimer;
  v.g_OwnedApps = [];

  v.checkMinPlaytime = function(){
    $('#'+v.accountName+' .li-img img').attr("class","online");
    $('#'+v.accountName+' .li-sub').html("Checking app playtime...");
    v.client.webLogOn();
    v.client.once('webSession', function(sessionID, cookies) {
      cookies.forEach(function(cookie) {
        v.g_Jar.setCookie(cookie, 'https://steamcommunity.com');
      });
      v.request("https://steamcommunity.com/my/badges/?p="+v.g_Page, function(err, response, body) {
        if(err || response.statusCode != 200) {
          error(bot, "Couldn't request badge page: " + (err || "HTTP error " + response.statusCode) + ". Retrying in 10 seconds...");
          setTimeout(v.checkMinPlaytime, 10000);
          return;
        }

        var lowHourApps = [];
        var ownedPackages = v.client.licenses.map(function(license) {
          var pkg = v.client.picsCache.packages[license.package_id].packageinfo;
          pkg.time_created = license.time_created;
          pkg.payment_method = license.payment_method;
          return pkg;
        }).filter(function(pkg) {
          return !(pkg.extended && pkg.extended.freeweekend);
        });
        $_ = Cheerio.load(body);
        $_('.badge_row').each(function() {
          var row = $_(this);
          var overlay = row.find('.badge_row_overlay');
          if(!overlay) {
            return;
          }

          var match = overlay.attr('href').match(/\/gamecards\/(\d+)/);
          if(!match) {
            return;
          }

          var appid = parseInt(match[1], 10);

          var name = row.find('.badge_title');
          name.find('.badge_view_details').remove();
          name = name.text().replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').trim();

          // Check if app is owned
          if(!v.client.picsCache.apps.hasOwnProperty(appid)) {
            debug(bot, "Skipping app " + appid + " \"" + name + "\" - not owned");
            return;
          }

          var newlyPurchased = false;
          // Find the package(s) in which we own this app
          ownedPackages.filter(function(pkg) {
            return pkg.appids && pkg.appids.indexOf(appid) != -1;
          }).forEach(function(pkg) {
            var timeCreatedAgo = Math.floor(Date.now() / 1000) - pkg.time_created;
            if(timeCreatedAgo < (60 * 60 * 24 * 14) && [Steam.EPaymentMethod.ActivationCode, Steam.EPaymentMethod.GuestPass, Steam.EPaymentMethod.Complimentary].indexOf(pkg.payment_method) == -1) {
              newlyPurchased = true;
            }
          });

          // Find out if we have drops left
          var drops = row.find('.progress_info_bold').text().match(/(\d+) card drops? remaining/);
          if(!drops) {
            return;
          }

          drops = parseInt(drops[1], 10);
          if(isNaN(drops) || drops < 1) {
            return;
          }

          // Find out playtime
          var playtime = row.find('.badge_title_stats').html().match(/(\d+\.\d+) hrs on record/);
          if(!playtime) {
            playtime = 0;
          } else {
            playtime = parseFloat(playtime[1], 10);
            if(isNaN(playtime)) {
              playtime = 0;
            }
          }

          if(playtime < 2) {
            // It needs hours!

            lowHourApps.push({
              "appid": appid,
              "name": name,
              "playtime": playtime,
              "newlyPurchased": newlyPurchased,
              "icon": v.client.picsCache.apps[appid].appinfo.common.icon
            });
          }

          if(playtime >= 2 || !newlyPurchased) {
            v.g_OwnedApps.push(appid);
          }
        });

        if(lowHourApps.length > 0) {
          var minPlaytime = 2;
          var newApps = [];

          lowHourApps.forEach(function(app) {
            if(app.playtime < minPlaytime) {
              minPlaytime = app.playtime;
            }

            if(app.newlyPurchased) {
              newApps.push(app);
            }
          });

          var lowAppsToIdle = [];

          lowAppsToIdle = lowHourApps.map(function(app) { return app.appid; });
          startErUp();

          function startErUp() {
            if(lowAppsToIdle.length < 1) {
              v.checkCardApps();
            } else {
              v.g_OwnedApps = v.g_OwnedApps.concat(lowAppsToIdle);
              new Notification("Steam Card Farmer: "+bot,{body:"Idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.\nYou likely won't receive any card drops in this time.\nThis will take " + (2 - minPlaytime) + " hours.",icon: v.avatar}).onclick = function(){this.close();};
              info(bot, "idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.\nYou likely won't receive any card drops in this time.\nThis will take " + (2.0 - minPlaytime) + " hours.");
              $('#'+v.accountName+' .li-sub').html("Idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.");
              v.client.gamesPlayed(lowAppsToIdle);
              $('#'+v.accountName+' .li-img img').attr("class","ingame");
              v.checkCardsInSeconds(1000 * 60 * 60 * (2 - minPlaytime));
            }
          }
        } else {
          v.checkCardApps();
        }
      });
    });
  }
  v.client.on('newItems', function(count){
    if(v.g_OwnedApps.length == 0 || count == 0) {
      return;
    }
    info(bot, "Got notification of new inventory items: " + count + " new item" + (count == 1 ? '' : 's'));
    v.checkCardApps();
  });
  v.checkCardApps = function() {
    if(v.g_CheckTimer) {
      clearTimeout(v.g_CheckTimer);
    }
    $('#'+v.accountName+' .li-img img').attr("class","online");
    $('#'+v.accountName+' .li-sub').html("Checking remaining card drops...");

    v.client.webLogOn();
    v.client.once('webSession', function(sessionID, cookies) {
      cookies.forEach(function(cookie) {
        v.g_Jar.setCookie(cookie, 'https://steamcommunity.com');
      });

      v.request("https://steamcommunity.com/my/badges/?p="+v.g_Page, function(err, response, body) {
        if(err || response.statusCode != 200) {
          error(bot, "couldn't request badge page: " + (err || "HTTP error " + response.statusCode));
          v.checkCardsInSeconds(30);
          return;
        }

        var appsWithDrops = 0;
        var totalDropsLeft = 0;
        var appLaunched = false;

        var $_ = Cheerio.load(body);
        var infolines = $_('.progress_info_bold');

        for(var i = 0; i < infolines.length; i++) {
          var match = $_(infolines[i]).text().match(/(\d+) card drops? remaining/);

          var href = $_(infolines[i]).closest('.badge_row').find('.badge_title_playgame a').attr('href');
          if(!href) {
            continue;
          }

          var urlparts = href.split('/');
          var appid = parseInt(urlparts[urlparts.length - 1], 10);

          if(!match || !parseInt(match[1], 10) || v.g_OwnedApps.indexOf(appid) == -1) {
            continue;
          }

          appsWithDrops++;
          totalDropsLeft += parseInt(match[1], 10);

          if(!appLaunched) {
            appLaunched = true;

            var title = $_(infolines[i]).closest('.badge_row').find('.badge_title');
            title.find('.badge_view_details').remove();
            title = title.text().trim();
            info(bot, "idling \"" + title + "\"\n" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining");
            $('#'+v.accountName+' .li-sub').html("Idling " + title + "<br>" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining").onclick = function(){this.close();};
            new Notification("Steam Card Farmer "+bot,{body:"Idling \"" + title + "\"\n" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining",icon: v.avatar}).onclick = function(){this.close();};
            v.client.gamesPlayed(["Farming Steam Cards",parseInt(appid, 10)]);
            $('#'+v.accountName+' .li-img img').attr("class","ingame");
          }
        }
        //fadeout loading window
        debug(bot, totalDropsLeft + " card drop" + (totalDropsLeft == 1 ? '' : 's') + " remaining across " + appsWithDrops + " app" + (appsWithDrops == 1 ? '' : 's') + " (Page " + v.g_Page + ")");
        if(totalDropsLeft == 0) {
          if ($_('.badge_row').length == 150){
            debug(bot, "no drops remaining on page "+v.g_Page);
            v.g_Page++;
            debug(bot, "checking page "+v.g_Page);
            v.checkMinPlaytime();
          } else {
            new Notification("Steam Card Farmer: "+bot,{body:"All card drops received!", icon: v.avatar}).onclick = function(){this.close();};
            $('#'+v.accountName+' .li-img img').attr("class", "ingame");
            $('#'+v.accountName+' .li-sub').html("Idling Hours<br\>All card drops received!");
            v.client.gamesPlayed(["Nothing.\nJust Doing Bot Things,\nbeep boop beep",440,570,730,365670,452780,466170,452780]);
            info(bot, 'All card drops received! Idling hours for default apps.');
          }
        } else {
          v.checkCardsInSeconds(1200); // 20 minutes to be safe, we should automatically check when Steam notifies us that we got a new item anyway
        }
      });
    });
  }

  v.checkCardsInSeconds = function(seconds = 1200) {
    clearTimeout(v.g_CheckTimer);
    v.g_CheckTimer = setTimeout(v.checkCardApps, (1000 * seconds));
  }

};
//*/

//Close App
var shutdown = (code=0)=>{
  /*
  bots[bot].client.logOff();
  bots[bot].client.once('disconnected', function() {
    process.exit(code);
  });
  */
  setTimeout(()=>{
    process.exit(code);
  }, 500);
}

//Right click menu
mainmenu = new gui.Menu();
mainmenu.append(new gui.MenuItem({
    label: 'New Bot',
    click: ()=>{
      alert("Not Working Yet, Sorry!");
    }
  }));
mainmenu.append(new gui.MenuItem({
    label: 'Reload',
    click: ()=>{
      win.reload();
    }
  }));
mainmenu.append(new gui.MenuItem({ type: 'separator' }));
mainmenu.append(new gui.MenuItem({
    label: 'Exit',
    click: ()=>{
      if(confirm("Are you sure you want exit?")){
        shutdown();
      }
    }
  }));

$(document).on('contextmenu', function(ev) {
  ev.preventDefault();
  mainmenu.popup(ev.pageX, ev.pageY);
  return false;
});

const BOTS = {};

bots.forEach(bot => {
  BOTS[bot.nickname] = new Bot(bot);
});
