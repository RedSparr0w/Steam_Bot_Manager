var SteamUser = require('steam-user');
var Steam = SteamUser.Steam;
var SteamCommunity = require('steamcommunity');
var TradeOfferManager = require('steam-tradeoffer-manager');
var request = require('request');
var Cheerio = require('cheerio');
var fs = require("fs");
var gui = require('nw.gui'); //or global.window.nwDispatcher.requireNwGui() (see https://github.com/rogerwang/node-webkit/issues/707)

// Get the current window
var win = gui.Window.get();
var clipboard = gui.Clipboard.get();

function dateTime(date = new Date()) {
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

var admin = {
  "steamID3": "[U:1:16663071]",
  "accountID": "16663071",
  "steamID64": "76561197976928799"
}

// all bots
var bots = require('./bots.js');
var newBot = function(bot, v) {
  v.g_Jar = request.jar();
  v.request = request.defaults({
    "jar": v.g_Jar
  });
  v.g_Page = 1;
  v.g_CheckTimer;
  v.g_OwnedApps = [];

  v.client = new SteamUser({
    "enablePicsCache": true,
    "promptSteamGuardCode": false
  });

  v.manager = new TradeOfferManager({
    "steam": v.client, // Polling every 30 seconds is fine since we get notifications from Steam
    "domain": "redsparr0w.com", // Our domain is example.com
    "language": "en" // We want English item descriptions
  });
  v.community = new SteamCommunity();

  v.logIn = () => {
    v.client.logOn({
      accountName: v.username,
      password: v.password,
    });
  }
  v.logIn();

  v.client.on('webSession', function(sessionID, cookies) {
    v.manager.setCookies(cookies, function(err) {
      if (err) {
        error(bot, err);
        process.exit(1); // Fatal error since we couldn't get our API key
        return;
      }
    });
    v.community.setCookies(cookies);
    v.community.startConfirmationChecker(30000, v.identity_secret); // Checks and accepts confirmations every 30 seconds
  });

  v.manager.on('newOffer', function(offer) {
    info(bot, "New offer #" + offer.id + " from " + offer.partner.getSteamID64());
    info(bot, offer);
    /*
    if(offer.partner.getSteamID64() == admin.steamID64){
    	offer.accept(function(err) {
    		if (err) {
    			error(bot, "Unable to accept offer: " + err.message);
    		} else {
    			community.checkConfirmations(); // Check for confirmations right after accepting the offer
    			info(bot, "Offer accepted");
    		}
    	});
    }else{
    	*/
    v.community.getSteamUser(offer.partner, function(err, otherUser) {
      var message = (offer.message.length > 0 ? offer.message : "Click here to view →");
      gui.Window.open("newtrade.html", {
        position: 'center',
        width: 1920,
        height: 1080
      }, function(tradewin) {
        new Notification('New Trade Offer From: ' + otherUser.name, {
          body: offer.message,
          icon: "http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/5f/" + otherUser.avatarHash + "_full.jpg"
        }).onclick = function() {
          this.close();
          tradewin.minimize();
          tradewin.restore();
          tradewin.show();
          tradewin.minimize();
          tradewin.restore();
        }
        tradewin.on("loaded", function() {
          tradewin.maximize();
          var tradeDiv = $('#TradeWindow', tradewin.window.document);
          $('#CurrentUser h3', tradeDiv).html(v.name + "'s items:");
          $.each(offer.itemsToGive, function(i, v) {
            $.ajax({
              method: "GET",
              url: 'http://steamcommunity.com/market/priceoverview/?appid=' + v.appid + '&country=NZ&currency=22&market_hash_name=' + encodeURI(v.market_hash_name),
              success: function(cardData) {
                $('#CurrentUser', tradeDiv).append('<div class="item col-xs-12 container"><img src="http://steamcommunity-a.akamaihd.net/economy/image/' + (v.icon_url_large.length > 1 ? v.icon_url_large : v.icon_url) + '" class="col-xs-4 col-lg-3" /><div class="col-xs-8 col-lg-9 info"><h4 class="li-head" style="width:100%;">' + v.market_name + '</h4><p class="li-sub">' + v.type + '</p><p class="li-sub">Average: ' + cardData.median_price + ' | Lowest: ' + cardData.lowest_price + '</p></div></div>');
              },
              timeout: 2000,
              error: function() {
                $('#CurrentUser', tradeDiv).append('<div class="item col-xs-12 container"><img src="http://steamcommunity-a.akamaihd.net/economy/image/' + (v.icon_url_large.length > 1 ? v.icon_url_large : v.icon_url) + '" class="col-xs-4 col-lg-3" /><div class="col-xs-8 col-lg-9 info"><h4 class="li-head" style="width:100%;">' + v.market_name + '</h4><p class="li-sub">' + v.type + '</p><p class="li-sub">unable to get prices</p></div></div>');
              }
            });
          });
          $('#OtherUser h3', tradeDiv).html(otherUser.name + "'s items:");
          $.each(offer.itemsToReceive, function(i, v) {
            $.ajax({
              method: "GET",
              url: 'http://steamcommunity.com/market/priceoverview/?appid=' + v.appid + '&country=NZ&currency=22&market_hash_name=' + encodeURI(v.market_hash_name),
              success: function(cardData) {
                $('#OtherUser', tradeDiv).append('<div class="item col-xs-12 container"><img src="http://steamcommunity-a.akamaihd.net/economy/image/' + (v.icon_url_large.length > 1 ? v.icon_url_large : v.icon_url) + '" class="col-xs-4 col-lg-3" /><div class="col-xs-8 col-lg-9 info"><h4 class="li-head" style="width:100%;">' + v.market_name + '</h4><p class="li-sub">' + v.type + '</p><p class="li-sub">Average: ' + cardData.median_price + ' | Lowest: ' + cardData.lowest_price + '</p></div></div>');
              },
              timeout: 2000,
              error: function() {
                $('#OtherUser', tradeDiv).append('<div class="item col-xs-12 container"><img src="http://steamcommunity-a.akamaihd.net/economy/image/' + (v.icon_url_large.length > 1 ? v.icon_url_large : v.icon_url) + '" class="col-xs-4 col-lg-3" /><div class="col-xs-8 col-lg-9 info"><h4 class="li-head" style="width:100%;">' + v.market_name + '</h4><p class="li-sub">' + v.type + '</p><p class="li-sub">unable to get prices</p></div></div>');
              }
            });
          });
          //Check if user accepts or declines trade
          $('.trade-btn', tradeDiv).click(function() {
            if ($(this).val() == "accept") {
              offer.accept(function(err) {
                if (err) {
                  error(bot, "Unable to accept offer: " + err.message);
                } else {
                  v.community.checkConfirmations(); // Check for confirmations right after accepting the offer
                  info(bot, "Offer accepted");
                }
              });
            } else if ($(this).val() == "decline") {
              offer.decline(function(err) {
                info(bot, "Offer declined");
              });
            }
            tradewin.close();
          });
        });
      });
    });
    /*
		}
		*/
  });

  if (fs.existsSync('polldata/' + bot + '_polldata.json')) {
    v.manager.pollData = JSON.parse(fs.readFileSync('polldata/' + bot + '_polldata.json'));
  }

  v.manager.on('pollData', function(pollData) {
    fs.writeFile('polldata/' + bot + '_polldata.json', JSON.stringify(pollData));
  });

  v.client.on('steamGuard', function(domain, callback, lastcode) {
    if (domain != null) {
      auth_msg = bot + " Auth Code\nEmailed to address *******@" + domain + ":";
    } else if (v.hasOwnProperty("shared_secret") && !lastcode) {
      callback(SteamUser.generateAuthCode(v.shared_secret));
      return;
    } else {
      auth_msg = bot + " Mobile Auth Code:";
    }
    callback(prompt(auth_msg));
  });
  v.client.on('loggedOn', function() {
    v.client.setPersona(1);
    v.client.setUIMode(1);
    $('#' + v.username + ' .li-sub').html("Logged into Steam!");
    info(bot, "Logged into Steam!");
    $('#' + v.username + ' .li-img img').attr("class", "online");
    debug(bot, "Waiting for license info...");
    debug(bot, v.client);
  });

  v.client.on('appOwnershipCached', function() {
    debug(bot, "Got app ownership info");
    v.client.setPersona(SteamUser.EPersonaState[(v.state !== undefined ? v.state : "Online")]);
    v.checkMinPlaytime();
  });

  v.client.once('accountInfo', function(name) {
    v.community.getSteamUser(v.client.steamID, function(err, data) {
      v.avatar = "http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/5f/" + data.avatarHash + "_full.jpg";
      v.name = name;
      $('#MultiAppsWindow').show().find('ul').append('<li id="' + v.username + '"><div class="li-img"><img src="' + v.avatar + '" alt="' + name + '" /></div><div class="li-text"><h4 class="li-head">' + name + '</h4><p class="li-sub"></p></div></li>');
      if (v.hasOwnProperty("shared_secret")) {
        $("#" + v.username + " img").click(function() {
          var AuthCode = SteamUser.generateAuthCode(v.shared_secret);
          clipboard.set(AuthCode);
          new Notification(name + " Auth Code:", {
            body: AuthCode + " (copied to clipboard)",
            icon: v.avatar
          }).onclick = function() {
            this.close();
          };
        });
      }
      $('#' + v.username + ' .li-img img').attr("class", "online");
      //Setup Bot Menu
      v.menu = new gui.Menu();

      var setStatusMenu = new gui.Menu();
      setStatusMenu.append(new gui.MenuItem({
        label: 'Online',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.Online);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Busy',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.Busy);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Away',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.Away);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Snooze',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.Snooze);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Looking to Trade',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.LookingToTrade);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Looking to Play',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.LookingToPlay);
        }
      }));
      setStatusMenu.append(new gui.MenuItem({
        label: 'Offline',
        click: function() {
          v.client.setPersona(SteamUser.EPersonaState.Offline);
        }
      }));
      v.menu.append(new gui.MenuItem({
        label: 'Set Status',
        submenu: setStatusMenu
      }));
      v.menu.append(new gui.MenuItem({
        type: 'separator'
      }));
      v.menu.append(new gui.MenuItem({
        label: 'Signout',
        click: function() {
          v.logOff();
        }
      }));

      $('#' + v.username).on('contextmenu', function(ev) {
        ev.preventDefault();
        v.menu.popup(ev.pageX, ev.pageY);
        return false;
      });
    });

  });

  v.client.on('error', function(e) {
    $('#' + v.username + ' .li-img img').attr("class", "offline");
    error(bot, `Error:\n`, e.message + '\n', [e]);
    if (e.message == "LoggedInElsewhere" || e.message == "LogonSessionReplaced") {
      $('#' + v.username + ' .li-sub').html("In Game Elsewhere!");
      setTimeout(() => {
        v.checkMinPlaytime();
      }, 30 * 6e4 /* 30 minutes */ );
      return;
    } else {
      v.logOff();
      $('#' + v.username + ' .li-sub').html("Offline!");
      setTimeout(() => {
        v.logIn();
      }, 30 * 6e4 /* 30 minutes */ );
    }
  });

  v.checkMinPlaytime = function() {
    $('#' + v.username + ' .li-img img').attr("class", "online");
    $('#' + v.username + ' .li-sub').html("Checking app playtime...");
    v.client.webLogOn();
    v.client.once('webSession', function(sessionID, cookies) {
      const ownedPackages = v.client.licenses.map(function(license) {
        let pkg = v.client.picsCache.packages[license.package_id].packageinfo;
        pkg.time_created = license.time_created;
        pkg.payment_method = license.payment_method;
        return pkg;
      }).filter(function(pkg) {
        return !(pkg.extended && pkg.extended.freeweekend);
      });
      cookies.forEach(function(cookie) {
        v.g_Jar.setCookie(cookie, 'https://steamcommunity.com');
      });
      v.request("https://steamcommunity.com/my/badges/?p=" + v.g_Page, function(err, response, body) {
        if (err || response.statusCode != 200) {
          error(bot, "Couldn't request badge page: " + (err || "HTTP error " + response.statusCode) + ". Retrying in 10 seconds...");
          setTimeout(v.checkMinPlaytime, 10000);
          return;
        }

        var lowHourApps = [];
        $_ = Cheerio.load(body);
        $_('.badge_row').each(function() {
          var row = $_(this);
          var overlay = row.find('.badge_row_overlay');
          if (!overlay) {
            return;
          }

          var match = overlay.attr('href').match(/\/gamecards\/(\d+)/);
          if (!match) {
            return;
          }

          var appid = parseInt(match[1], 10);

          var name = row.find('.badge_title');
          name.find('.badge_view_details').remove();
          name = name.text().replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '').trim();

          // Check if app is owned
          if (!v.client.picsCache.apps.hasOwnProperty(appid)) {
            debug(bot, "Skipping app " + appid + " \"" + name + "\" - not owned");
            return;
          }

          var newlyPurchased = false;
          // Find the package(s) in which we own this app
          ownedPackages.filter(function(pkg) {
            return pkg.appids && pkg.appids.indexOf(appid) != -1;
          }).forEach(function(pkg) {
            var timeCreatedAgo = Math.floor(Date.now() / 1000) - pkg.time_created;
            if (timeCreatedAgo < (60 * 60 * 24 * 14) && [Steam.EPaymentMethod.ActivationCode, Steam.EPaymentMethod.GuestPass, Steam.EPaymentMethod.Complimentary].indexOf(pkg.payment_method) == -1) {
              newlyPurchased = true;
            }
          });

          // Find out if we have drops left
          var drops = row.find('.progress_info_bold').text().match(/(\d+) card drops? remaining/);
          if (!drops) {
            return;
          }

          drops = parseInt(drops[1], 10);
          if (isNaN(drops) || drops < 1) {
            return;
          }

          // Find out playtime
          var playtime = row.find('.badge_title_stats').html().match(/(\d+\.\d+) hrs on record/);
          if (!playtime) {
            playtime = 0;
          } else {
            playtime = parseFloat(playtime[1], 10);
            if (isNaN(playtime)) {
              playtime = 0;
            }
          }

          if (playtime < 2) {
            // It needs hours!

            lowHourApps.push({
              "appid": appid,
              "name": name,
              "playtime": playtime,
              "newlyPurchased": newlyPurchased,
              "icon": v.client.picsCache.apps[appid].appinfo.common.icon
            });
          }

          if (playtime >= 2 || !newlyPurchased) {
            v.g_OwnedApps.push(appid);
          }
        });

        if (lowHourApps.length > 0) {
          var minPlaytime = 2;
          var newApps = [];

          lowHourApps.forEach(function(app) {
            if (app.playtime < minPlaytime) {
              minPlaytime = app.playtime;
            }

            if (app.newlyPurchased) {
              newApps.push(app);
            }
          });

          var lowAppsToIdle = [];

          lowAppsToIdle = lowHourApps.map(function(app) {
            return app.appid;
          });
          startErUp();

          function startErUp() {
            if (lowAppsToIdle.length < 1) {
              v.checkCardApps();
            } else {
              v.g_OwnedApps = v.g_OwnedApps.concat(lowAppsToIdle);
              new Notification("Steam Card Farmer: " + bot, {
                body: "Idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.\nYou likely won't receive any card drops in this time.\nThis will take " + (2 - minPlaytime) + " hours.",
                icon: v.avatar
              }).onclick = function() {
                this.close();
              };
              info(bot, "idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.\nYou likely won't receive any card drops in this time.\nThis will take " + (2.0 - minPlaytime) + " hours.");
              $('#' + v.username + ' .li-sub').html("Idling " + lowAppsToIdle.length + " app" + (lowAppsToIdle.length == 1 ? '' : 's') + " up to 2 hours.");
              v.client.gamesPlayed(lowAppsToIdle);
              $('#' + v.username + ' .li-img img').attr("class", "ingame");
              v.checkCardsInSeconds(1000 * 60 * 60 * (2 - minPlaytime));
            }
          }
        } else {
          v.checkCardApps();
        }
      });
    });
  }
  v.client.on('newItems', function(count) {
    if (v.g_OwnedApps.length == 0 || count == 0) {
      return;
    }
    info(bot, "Got notification of new inventory items: " + count + " new item" + (count == 1 ? '' : 's'));
    v.checkCardApps();
  });
  v.checkCardApps = function() {
    if (v.g_CheckTimer) {
      clearTimeout(v.g_CheckTimer);
    }
    $('#' + v.username + ' .li-img img').attr("class", "online");
    $('#' + v.username + ' .li-sub').html("Checking remaining card drops...");

    v.client.webLogOn();
    v.client.once('webSession', function(sessionID, cookies) {
      cookies.forEach(function(cookie) {
        v.g_Jar.setCookie(cookie, 'https://steamcommunity.com');
      });

      v.request("https://steamcommunity.com/my/badges/?p=" + v.g_Page, function(err, response, body) {
        if (err || response.statusCode != 200) {
          error(bot, "couldn't request badge page: " + (err || "HTTP error " + response.statusCode));
          v.checkCardsInSeconds(30);
          return;
        }

        var appsWithDrops = 0;
        var totalDropsLeft = 0;
        var appLaunched = false;

        var $_ = Cheerio.load(body);
        var infolines = $_('.progress_info_bold');

        for (var i = 0; i < infolines.length; i++) {
          var match = $_(infolines[i]).text().match(/(\d+) card drops? remaining/);

          var href = $_(infolines[i]).closest('.badge_row').find('.badge_title_playgame a').attr('href');
          if (!href) {
            continue;
          }

          var urlparts = href.split('/');
          var appid = parseInt(urlparts[urlparts.length - 1], 10);

          if (!match || !parseInt(match[1], 10) || v.g_OwnedApps.indexOf(appid) == -1) {
            continue;
          }

          appsWithDrops++;
          totalDropsLeft += parseInt(match[1], 10);

          if (!appLaunched) {
            appLaunched = true;

            var title = $_(infolines[i]).closest('.badge_row').find('.badge_title');
            title.find('.badge_view_details').remove();
            title = title.text().trim();
            info(bot, "idling \"" + title + "\"\n" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining");
            $('#' + v.username + ' .li-sub').html("Idling " + title + "<br>" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining").onclick = function() {
              this.close();
            };
            new Notification("Steam Card Farmer " + bot, {
              body: "Idling \"" + title + "\"\n" + match[1] + " drop" + (match[1] == 1 ? '' : 's') + " remaining",
              icon: v.avatar
            }).onclick = function() {
              this.close();
            };
            v.client.gamesPlayed(["Farming Steam Cards", parseInt(appid, 10)]);
            $('#' + v.username + ' .li-img img').attr("class", "ingame");
          }
        }
        //fadeout loading window
        debug(bot, totalDropsLeft + " card drop" + (totalDropsLeft == 1 ? '' : 's') + " remaining across " + appsWithDrops + " app" + (appsWithDrops == 1 ? '' : 's') + " (Page " + v.g_Page + ")");
        if (totalDropsLeft == 0) {
          if ($_('.badge_row').length == 150) {
            debug(bot, "no drops remaining on page " + v.g_Page);
            v.g_Page++;
            debug(bot, "checking page " + v.g_Page);
            v.checkMinPlaytime();
          } else {
            new Notification("Steam Card Farmer: " + bot, {
              body: "All card drops received!",
              icon: v.avatar
            }).onclick = function() {
              this.close();
            };
            $('#' + v.username + ' .li-img img').attr("class", "ingame");
            $('#' + v.username + ' .li-sub').html("Idling Hours<br\>All card drops received!");
            v.client.gamesPlayed(["Nothing.\nJust Doing Bot Things,\nbeep boop beep", 440, 570, 730, 365670, 452780, 466170, 452780]);
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

  v.logOff = function() {
    v.client.logOff();
    v.client.once('disconnected', function() {
      v.client = "";
      $('#' + v.username).remove();
    });

    setTimeout(function() {
      v.client = "";
      $('#' + v.username).remove();
    }, 500);
  }

  //Check keys
  v.client.on('friendMessage', function(steamID, message) {
    if (/^[\d\w]{2,5}(\-[\d\w]{4,5}){2,4}$/.test(message)) {
      v.client.redeemKey(message, function(result, details, packages) {
        games = "";
        $.each(packages, function(appID, appName) {
          games += (appName + "\n");
        });
        if (result == 1) {
          v.client.chatMessage(steamID, bot + " Successfully activated:" + games);
          v.g_Page = 1;
          v.checkMinPlaytime();
        } else {
          v.client.chatMessage(steamID, bot + " Failed to activate:" + games);
        }
      });
    } else {
      v.community.getSteamUser(steamID, function(err, otherUser) {
        new Notification(otherUser.name + " → " + bot, {
          body: message,
          icon: "http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/5f/" + otherUser.avatarHash + "_full.jpg"
        }).onclick = function() {
          this.close();
        };
      });
    }
  });
};

//Close App
var shutdown = (code = 0) => {
  /*
	bots[bot].client.logOff();
	bots[bot].client.once('disconnected', function() {
		process.exit(code);
	});
  */
  setTimeout(() => {
    process.exit(code);
  }, 500);
}

//Right click menu
mainmenu = new gui.Menu();
mainmenu.append(new gui.MenuItem({
  label: 'New Bot',
  click: () => {
    alert("Not Working Yet, Sorry!");
  }
}));
mainmenu.append(new gui.MenuItem({
  label: 'Reload',
  click: () => {
    win.reload();
  }
}));
mainmenu.append(new gui.MenuItem({
  type: 'separator'
}));
mainmenu.append(new gui.MenuItem({
  label: 'Exit',
  click: () => {
    if (confirm("Are you sure you want exit?")) {
      shutdown();
    }
  }
}));

$(document).on('contextmenu', function(ev) {
  ev.preventDefault();
  mainmenu.popup(ev.pageX, ev.pageY);
  return false;
});

bots.forEach(bot => {
  newBot(bot.nickname, bot);
});
