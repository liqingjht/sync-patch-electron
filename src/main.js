var { app, BrowserWindow, ipcMain } = require('electron');
var path = require('path');
var reUrl = require('url');
var fs = require("fs");
var os = require("os");
var crypto = require('crypto');
var request = require('request');

var serverIP = "http://127.0.0.1:2048/";
var serverAPI = {
    getList: serverIP + "getList",
    getToken: serverIP + "getToken",
    saveUserInfo: serverIP + "saveUserInfo"
}

setTimeout(function() {
	postUserInfo(getUserInfo());
}, 3000)

var projectInfo = new Object();

try {
    let confStr = fs.readFileSync('./config.json', 'utf-8');
    var conf = JSON.parse(confStr);
} catch (err) {
    console.log(err);
    process.exit(1);
}

var mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 960,
        height: 640,
        show: false,
        center: true,
        resizable: false,
        frame: false
    })

    mainWindow.once('ready-to-show', function() {
		getProjectInfo(true);
		mainWindow.webContents.send("init-settings", conf);
        mainWindow.show()
    })

    mainWindow.loadURL(reUrl.format({
        pathname: path.join(__dirname, "html/index.html"),
        protocol: 'file:',
        slashes: true
    }))

    //mainWindow.webContents.openDevTools()
    mainWindow.on('closed', function() {
        mainWindow = null
    })
}

app.on('ready', createWindow);

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.on('activate', function() {
    if (mainWindow === null) {
        createWindow()
    }
})

ipcMain.on('close-main-window', function() {
    app.quit();
});

ipcMain.on('top-main-window', function(event, flag) {
    mainWindow.setAlwaysOnTop(flag);
});

ipcMain.on('mini-main-window', function() {
    mainWindow.minimize()
});

ipcMain.on('update-settings', function(event, config) {
	saveConfig(config);
});

function getUserInfo() {
    var userInfo = new Object();
    userInfo.hostname = os.hostname();
    userInfo.username = os.userInfo().username;
    var interFaces = os.networkInterfaces();
    for (let i in interFaces) {
        for (let j in interFaces[i]) {
            if (/^172\.17\./g.test(interFaces[i][j].address)) {
                userInfo.mac = interFaces[i][j].mac.toUpperCase();
            }
        }
    }
    return userInfo;
}

function postUserInfo(userInfo) {
    request.get(serverAPI.getToken, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var key = encodeToken(body);
            userInfo.token = body;
            userInfo.key = key;
            request({
                method: 'POST',
                uri: serverAPI.saveUserInfo,
                json: true,
                body: userInfo
            }, function(error, response, body) {
                if (!error && response.statusCode == 200 && body == "success")
                    console.log("save user infomation successfully");
            });
        } else {
            console.log("save user infomation failed");
        }
    })
}

function getProjectInfo(firstTime) {
    if(firstTime) {
		fs.readFile("./projectInfo.json", "utf-8", function(err, data) {
    	    if (err)
    	        return;
    	    try {
    	        var tmp = JSON.parse(data);
				if(typeof tmp.Projects == "undefined" || tmp.Projects.length == 0)
					return;
    	        projectInfo = tmp;
				mainWindow.webContents.send("init-auto-complete", projectInfo);
    	    } catch (e) {
    	        console.log("Bad format json string from file");
    	    }
    	})
	}
    request.get(serverAPI.getList, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                var tmp = JSON.parse(body);
				if(typeof tmp.Projects == "undefined" || tmp.Projects.length == 0)
					return;
                projectInfo = tmp;
				mainWindow.webContents.send("init-auto-complete", projectInfo);
                fs.writeFile('./projectInfo.json', body, function(err) {
                    if (err)
                        return;
                });
            } catch (e) {
                console.log("Bad format string from server");
            }
        } else {
			mainWindow.webContents.send("internet-error");
            console.log("Can't get project information from server");
        }
    })
}

function encodeToken(token) {
    var secret = 'GuessMe@Defeng';
    var cipher = crypto.createCipher('aes192', secret);
    var enc = cipher.update(token, 'utf8', 'hex');
    enc += cipher.final('hex');
    return enc;
}

function saveConfig(config) {
	fs.writeFile('./config.json', JSON.stringify(config, null, '\t'), function(err) {
		if(err)
			console.log(err);
	})
}