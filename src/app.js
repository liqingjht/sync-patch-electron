var fs = require('fs');
var logs = require("./logs.js");
var trans = require("./transport.js");
var toGetLast = true;

try {
    var confStr = fs.readFileSync('./config.json', 'utf-8');
    var conf = JSON.parse(confStr);
} catch (err) {
    console.log(err);
    sendError("Read config file failed.");
}

var root = conf.bugzillaUrl.replace(/(.*\/)[^\/]+$/g, "$1");
var xmlUrl = root + "show_bug.cgi?ctype=xml&id=";
var processUrl = root + "process_bug.cgi";

var mode = process.argv[2];
trans.setMode(mode);

var task = new Array();

(async function() {
    if (!(await trans.login(conf))) {
        console.error("Login to Bugzilla failed. Please check the account.");
        sendError("Login to Bugzilla failed.");
    }

    var projectList = await trans.getProjectList(conf.maillistUrl);
    for (let i in conf[mode]) {
        if (conf[mode][i].active) {
            var project = conf[mode][i].project;
            if (typeof projectList[project] == "undefined") {
                console.warn("Can't find the project '" + project + "' in maillist. Ignore it.")
            } else {
                task.push(conf[mode][i]);
            }
        }
    }
	sendProgress(10);
    await trans.getProjectUrl(projectList, task);
	sendProgress(15);
    if (mode == "scheduled") {
        console.log(colors.green("Start to monitor new patch ..."));
        doTask();
        setInterval(doTask, 60000);
    } else if (mode == "fast") {
        doTask();
		process.send({'type': "done", 'msg': "Complete doing a fast task."});
    }
})();

async function doTask() {
    await generateBugList();
    await postInfo();
    for (let i in task) {
        delete task[i].patchList;
    }
    if (mode == "fast")
        await logs.saveLogs();
    else
        await logs.clearExtraLogs(0);
}

async function generateBugList() {
    return new Promise(async function(resolve, reject) {
        try {
            await trans.getMonthList(task);
			sendProgress(25);
            await trans.getPatchList(task, toGetLast);
			sendProgress(35);
            toGetLast = false;
            //debugPost(); /*debug function*/
            if (mode == "scheduled") {
                for (let i in task) {
                    try {
                        task[i].lastPatch == task[i].patchList[0].link;
                    } catch (err) {
                        continue;
                    }
                    if (typeof task[i].lastPatch == "undefined" || task[i].lastPatch == task[i].patchList[0].link) {
                        task[i].lastPatch = task[i].patchList[0].link;
                        task[i].patchList.length = 0;
                        continue;
                    }
                    for (let j in task[i].patchList) {
                        if (task[i].lastPatch == task[i].patchList[j].link) {
                            task[i].patchList.splice(j, task[i].patchList.length - j);
                            task[i].lastPatch = task[i].patchList[0].link;
                            break;
                        }
                    }
                }
            }
            await trans.getPatchDetail(task);
            for (let i in task) {
                for (let j = 0;
                    (typeof task[i].patchList[j] != "undefined");) {
                    if (task[i].patchList[j].bugID == 0)
                        task[i].patchList.splice(j, 1);
                    else
                        j++;
                }
            }
			sendProgress(50);
            resolve();
        } catch (err) {
            console.error(err);
			sendError("Occur error when getting bugs.");
            reject(err);
        }
    })
}

async function postInfo() {
    return new Promise(async function(resolve, reject) {
        try {
            await trans.getBugInfo(xmlUrl, task);
            if (task[0].patchList.length > 0 && typeof task[0].patchList[0].token != "undefined" && task[0].patchList[0].token == "") {
                if (!(await trans.login(conf))) {
                    console.error("Login to Bugzilla failed. Please check the account.");
                    sendError("Login to Bugzilla failed.");
                }
            }
			sendProgress(70);
            await trans.postInfo(processUrl, task);
            //logs.debugLogsFunc(JSON.stringify(task[0].patchList[0]), 200);  /*debug function*/
			sendProgress(100);
            resolve();
        } catch (err) {
            console.error(err);
			sendError("Occur error when posting bugs.");
            reject(err);
        }
    })
}

var times = 0;

function debugPost() {
    task.length = 1;
    task[0].patchList = new Array();
    var bugID = [69055, 69334, 69335];
    var patchID = ["001671", "001685", "001690"];
    times++;
    if (times > bugID.length)
        times = bugID.length;
    for (let i = 0; i < times; i++) {
        task[0].patchList.unshift({
            auth: 'defeng.liu',
            title: '[R9000] [PATCH] R9000:[CD-LESS] Bug ' + bugID[i] + ' To test post function',
            link: 'http://dniserver.dnish.net/pipermail/r9000/2017-March/' + patchID[i] + '.html',
        })
    }
}

function sendError(msg) {
	process.send({'type': "error", 'msg': msg});
	process.exit(1);
}

function sendProgress(percent) {
	if(mode != "fast")
		return;
	process.send({'type': "status", 'msg': percent});
}