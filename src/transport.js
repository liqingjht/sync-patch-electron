var request = require("request");
var cheerio = require("cheerio");
var Agent = require('agentkeepalive');
var logs = require("./logs.js");

var cookie = request.jar();
var mode;

var keepaliveAgent = new Agent({
	maxSockets: 50,
	maxFreeSockets: 10,
	timeout: 60000,
	freeSocketKeepAliveTimeout: 30000
});

var option = {
    agent: keepaliveAgent,
	url: ""
};

function setMode(cmode) {
	mode = cmode;
}

function getProjectList(indexPage) {
	return getFunc(indexPage, function(url, $) {
		var projectList = new Array();
		var tr = $("body > table").eq(0).children("tr").slice(4);
		tr.each(function(key) {
			var link = url.replace(/(.*\/)[^\/]+$/g, "$1") + tr.eq(key).find("td a").attr("href");
			var name = tr.eq(key).find("td a strong").text();
			projectList[name] = link;
		})
		return projectList;
	})
}

function getProjectUrl(projectList, task) {
	return Promise.all(task.map(function(eachTask, index) {
		 return getFunc(projectList[eachTask.project], function(url, $) {
		 	task[index].link = $("body p table tr").slice(3).eq(0).find("td p a").attr("href");
		 })
	}))
}

function getMonthList(task) {
	var current = new Date();

	return Promise.all(task.map(function(eachTask, index) {
		if(mode == "fast") {
			var end = new Date(current.getTime() - (parseInt(eachTask.beforeDays)*24*60*60*1000));
			var endMon = end.getMonth();
			var endYear = end.getFullYear();
		}

		return getFunc(eachTask.link, function(url, $) {
			var monthList = new Array();
			var tr = $("table > tr").slice(1);
			tr.each(function(key) {
				var mon = tr.eq(key).children("td").eq(0).text();
				mon = mon.slice(0, mon.length-1);
				var link = url + tr.eq(key).children("td").eq(1).children("a:last-child").attr("href");
				if(mode == "fast") {
					var patchDate = new Date(mon);
					var patchMon = patchDate.getMonth();
					var patchYear = patchDate.getFullYear();
					if(patchYear < endYear || (patchYear == endYear && patchMon < endMon))
						return false;
				}
				monthList.push({"postMonth": mon, "monthLink": link});
				if(mode == "scheduled" && key > 0)
					return false;
			})
			task[index].monthList = monthList;
		})
	}))
}

function getPatchList(task, toGetLast) {
	return Promise.all(task.map(function(eachTask, index) {
		var promiseOneMonth = Promise.all(eachTask.monthList.map(function(eachMonth, num) {
			return getFunc(eachMonth.monthLink, function(url, $) {
				var oneMonthList = new Array();
				var li = $("body ul").eq(1).children("li");
				li.each(function(key) {
					var tmp = li.eq(key).children("a").eq(0);
					var title = tmp.text().replace(/\t/g, " ").replace(/\n$/g, "");
					var link = url.replace(/(.*\/)[^\/]+$/g, "$1") + tmp.attr("href");
					var auth = li.eq(key).children("i").text().replace("\n", "");
					auth = parseAuth(auth);
					if(mode == "scheduled" && toGetLast)
						oneMonthList.unshift({"auth": auth, "title": title, "link": link});
					else if(eachTask.engineers.length == 0 || eachTask.engineers.indexOf(auth) != -1)
						oneMonthList.unshift({"auth": auth, "title": title, "link": link});
				})
				return oneMonthList;
			})
		}))

		promiseOneMonth.then(function(oneMonthLists) {
			task[index].patchList = new Array();
			for(let j=0; j<oneMonthLists.length; j++) {
				if(typeof oneMonthLists[j] != "undefined")
					task[index].patchList = task[index].patchList.concat(oneMonthLists[j]);
			}
			delete task[index].monthList;

		})

		return promiseOneMonth;
	}))
}

function parseAuth(auth) {
	if(auth.length < 3)
		return false;
	if(auth.indexOf("=?") != -1)
		return false;
	if(auth.indexOf('"') != -1)
		auth = auth.replace(/"/g, "");
	var index = auth.indexOf(" at ");
	if(index != -1)
		auth = auth.slice(0, index);
	auth = auth.replace(/^([\w\.\s]*)[^\w]*$/g, "$1").trim();
	auth = auth.toLowerCase();
	auth = auth.replace(" ", ".");
	return auth;
}

function getPatchDetail(task) {
	var current = new Date();
	return Promise.all(task.map(function(eachTask, index) {
		return Promise.all(eachTask.patchList.map(function(eachPatch, num) {
			return getFunc(eachPatch.link, function(url, $) {
				var patchDetail = new Array();
				var sendTime = $("body > i").eq(0).text();
				var end = new Date(current.getTime() - (parseInt(eachTask.beforeDays)*24*60*60*1000));
				if((new Date(sendTime)).getTime() < end.getTime()) {
					task[index].patchList.splice(num, task[index].patchList.length-num);
					return false;
				}
				var title = $("body h1").eq(0).text();
				var content = $("body > p > pre").eq(0).text();
				var each = content.toString().split(/\n/gm);
				var description = "";
				for(i=0; i<each.length; i++){
					if(each[i].indexOf("Signed-off-by:") != -1) {
						description = each.slice(0, i).join("\n");
						break;
					}
				}
				var id;
				if(!(id = findBugID(title))) {
					id = findBugID(description);
				}
				task[index].patchList[num].bugID = id;
				task[index].patchList[num].sendTime = sendTime;
				task[index].patchList[num].description = description;
			})
		}))
	}))
}

function findBugID(str) {
	var bug = str.match(/bug([^\d]?|\s*)\d+/igm);
	if(bug == null)
		return 0;
	else {
		return parseInt(bug[0].replace(/[^\d]*/g, ""));
	}
}

function login(conf) {
	return postFunc(conf.bugzillaUrl, {
		Bugzilla_login: conf.username,
		Bugzilla_password: conf.password,
		GoAheadAndLogIn: "Log in"
	}, function(url, data) {
		var $ = cheerio.load(data);
		if($("head title").text().indexOf("Invalid") != -1)
			return false;
		else
			return true;
	})
}

function getBugInfo(xmlUrl, task) {
	return Promise.all(task.map(function(eachTask, index) {
		if(eachTask.patchList.length > 0)
			console.log("Found " + eachTask.patchList.length + " patches contained bug ID from " + eachTask.project + " maillist.");
		return Promise.all(eachTask.patchList.map(function(eachPatch, num) {
			return getFunc(xmlUrl+eachPatch.bugID, function(url, $) {
				var ts = $("bug > delta_ts").eq(0).text();
				task[index].patchList[num].delta_ts = ts.slice(0, ts.lastIndexOf(" "));
				task[index].patchList[num].token = $("bug > token").eq(0).text();
				task[index].patchList[num].longdesclength = $("long_desc").length;
				task[index].patchList[num].bug_status = $("bug_status").text();
				task[index].patchList[num].long_desc = $("long_desc").text();
				task[index].patchList[num].bug_desc = $("short_desc").text();
			}, 1)
		}))
	}))
}

function postInfo(processUrl, task) {
	return Promise.all(task.map(function(eachTask, index) {
		return Promise.all(eachTask.patchList.map(function(eachPatch, num) {
			if(eachPatch.long_desc.indexOf(eachPatch.link) != -1) {
				return true;
			}
			var comment = "Patch was sent by " + eachPatch.auth + " on " + (new Date(eachPatch.sendTime.replace(/CST\s/g, ""))).toLocaleString();
			comment += "\n\nURL: " + eachPatch.link;
			comment += "\n\nTopic: " + eachPatch.title.replace(/.*\[PATCH(\s\d+\/\d+)?\]\s(.*)/g, "$2");
			comment += (eachPatch.description == ""? "" : "\n\n"+eachPatch.description);
			//comment += "\n\n--------This message was posted by the tool which still in beta version."
			postData = {
				delta_ts: eachPatch.delta_ts,
				longdesclength: eachPatch.longdesclength,
				id: eachPatch.bugID,
				token: eachPatch.token,
				assigned_to : eachPatch.auth,
				comment: comment
			};
			if(eachTask.close && (eachPatch.bug_status == "NEW" || eachPatch.bug_status == "REOPENED")) {
				postData.bug_status = "RESOLVED";
				postData.resolution = "FIXED";
				eachPatch.bug_status = "RESOLVED";
			}
			return postFunc(processUrl, postData, function(url, data) {
				var $ = cheerio.load(data);
				if($("head title").text().indexOf(eachPatch.bugID) != -1) {
					delete eachPatch.long_desc;
					delete eachPatch.token;
					delete eachPatch.longdesclength;
					delete eachPatch.delta_ts;
					logs.addLog(JSON.stringify(eachPatch));
					if((num+1)/5 == 0 || (num+1) == eachTask.patchList.length)
						console.log("Done to post " + (num+1) + " patches information to Bugzilla. ---- " + ((num+1)/eachTask.patchList.length*100).toFixed(2) + "%")
					return true;
				}
			})
		}))
	}))
}

function getFunc(getUrl, parseFunc, needCookie) {
	return new Promise(function(resolve, reject) {
		option.url = getUrl;
		delete option.form;
		if(needCookie == 1)
			option.jar = cookie;
		else
			delete option.jar;
		request.get(option, function(error, response, body) {
			if(!error && response.statusCode == 200) {
				var $ = cheerio.load(body);
				var result = parseFunc(getUrl, $);
				resolve(result);
			}
			else {
				reject(error);
			}
		})
	})
}

function postFunc(postUrl, data, callback) {
	return new Promise(function(resolve, reject) {
		option.url = postUrl;
		option.jar = cookie;
		option.form = data;
		request.post(option, function(error, response, body) {
			if(!error && response.statusCode == 200) {
				var result = callback(postUrl, body);
				resolve(result);
			}
			else {
				reject(error);
			}
		})
	})
}

exports.setMode = setMode;

exports.getProjectList = getProjectList;
exports.getProjectUrl = getProjectUrl;
exports.getMonthList = getMonthList;
exports.getPatchList = getPatchList;
exports.getPatchDetail = getPatchDetail;

exports.getBugInfo = getBugInfo;
exports.login = login;
exports.postInfo = postInfo;
