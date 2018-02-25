var fs = require("fs");

var logsCache = new Array();
var logFile = "./runningLogs";
var deleteFile = false;

(async function() {
	try {
	    var fd = fs.openSync("./runningLogs", "w");
		fs.closeSync(fd);
	}
	catch(e) {
	    console.warn("Can't open runningLogs file");
	}

	process.on('SIGINT', async function (err) {
	    await saveLogs();
	    process.exit(0);
	});

	process.on("uncaughtException", async function(err) {
	    await saveLogs();
		process.exit(1);
	})
})()

function addLog(log) {
    logsCache.push({"time": (new Date()).toLocaleString(), "log": JSON.parse(log)});
}

function saveLogs(max) {
    var logs = "";
	max = max || 0;

    while(logsCache.length > max) {
        logs += JSON.stringify(logsCache[0], null, '\t') + "\n";
        logsCache.splice(0, 1);
    }

	return new Promise(function(resolve, reject) {
		fs.writeFile(logFile, logs, {'flag': 'a', 'encoding': "utf-8"}, function(err) {
			if(err)
				reject(err);
			else
				resolve(true);
		})
	})
}

async function clearExtraLogs(max) {
    if(logsCache.length > max) {
        await saveLogs(0);
    }
}

function debugLogsFunc(log, len) {
	logsCache.length = len;
	logsCache.fill(log);
}

exports.addLog = addLog;
exports.saveLogs = saveLogs;
exports.clearExtraLogs = clearExtraLogs;
exports.debugLogsFunc = debugLogsFunc;
