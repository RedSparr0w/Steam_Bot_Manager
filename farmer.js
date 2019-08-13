// all bots
const bots = require('./bots.js');
const Bot = require('./classes/bot.js');

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

bots.forEach(bot => {
  new Bot(bot);
});
