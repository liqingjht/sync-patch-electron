const { ipcRenderer } = require('electron')
var remote = require('electron').remote;
var childProcess = require('child_process');

var currentWindow = remote.getGlobal("mainWindow");
var conf;
var taskConfMapping = new Object();
var mailProjects = new Array();
var mailEngineers = new Array();
var proEngMapping = new Array();
var currentPanel;
var scheduleProcess;
var fastProcess;

$(".window_lock").on("click", function() {
    var ico = $(this).children("i")
    if (ico.hasClass("fa-unlock")) {
        ico.removeClass("fa-unlock").addClass("fa-lock");
        ipcRenderer.send('top-main-window', true);
    } else if (ico.hasClass("fa-lock")) {
        ico.removeClass("fa-lock").addClass("fa-unlock");
        ipcRenderer.send('top-main-window', false);
    }
})

$(".window_mini").on("click", function() {
    ipcRenderer.send('mini-main-window');
})

$(".window_close").on("click", function() {
    ipcRenderer.send('close-main-window');
})

$("#saveAccount").on("click", function(event) {
    if ($("#username").val() == "" || $("#password").val() == "") {
        showTempMsg("Setup your account for bugzilla.");
        return false;
    }
    event.showThisOne = "schedule";
    loadEffect(event);
    conf.username = $("#username").val();
    conf.password = $("#password").val();
    saveConfig();
})

/*********** For Init Settings *************/
ipcRenderer.on("init-settings", function(event, config) {
    conf = config;
    if (!!conf.firstStart) {
        $("#firstPage").fadeIn();
        conf.firstStart = false;
        saveConfig();
        $(".fa-chevron-down").on("click", function(event) {
            event.showThisOne = "login";
            loadEffect(event);
        });
    } else if (conf.username == "" || conf.password == "") {
        showTempMsg("Setup your account for bugzilla.");
        currentPanel = "login";
        $("#login").fadeIn();
    } else {
        currentPanel = "schedule";
        $("#schedule").fadeIn();
    }
	initTaskShow();
})

ipcRenderer.on("internet-error", function() {
	showTempMsg("Internet Error! Can not access 252 server.");
})

ipcRenderer.on("init-auto-complete", function(event, projectInfo) {
    var temp = new Array();
    for (let i in projectInfo.Projects) {
        var oneList = projectInfo.Projects[i];
        mailProjects.push({ 'value': oneList.project, 'data': oneList.project });
        temp = Array.from(new Set(temp.concat(oneList.engineers)));
        proEngMapping[oneList.project] = new Array();
        for (let j in oneList.engineers) {
            var onePer = oneList.engineers[j];
            proEngMapping[oneList.project].push({ 'value': onePer, 'data': onePer });
        }
    }
    for (let k in temp) {
        temp[k] = { 'value': temp[k], 'data': temp[k] };
    }
    mailEngineers = temp;
    var proWidget = $('#s-project').add("#f-project");
    var perWidget = $('#s-person').add("#f-person");
    proWidget.autocomplete({ lookup: mailProjects, lookupLimit: 6, onSelect: updateOptions });
    perWidget.autocomplete({ lookup: mailEngineers, lookupLimit: 6, onSelect: updateOptions });
    perWidget.on("input", function() {
        updateOptions();
    })

    function updateOptions() {
        var pro = (currentPanel == "schedule" ? $('#s-project') : $("#f-project"));
        var per = (currentPanel == "schedule" ? $('#s-person') : $("#f-person"));
        if (typeof proEngMapping[pro.val()] != "undefined") {
            per.autocomplete().clearCache();
            per.autocomplete().setOptions({ lookup: proEngMapping[pro.val()] });
        }
    }
})

function layerInit() {
    var diameterValue = (Math.sqrt(Math.pow($(window).height(), 2) + Math.pow($(window).width(), 2)) * 2);
    overlayNav.children('span').velocity({
        scaleX: 0,
        scaleY: 0,
        translateZ: 0,
    }, 50).velocity({
        height: diameterValue + 'px',
        width: diameterValue + 'px',
        top: -(diameterValue / 2) + 'px',
        left: -(diameterValue / 2) + 'px',
    }, 0);

    overlayContent.children('span').velocity({
        scaleX: 0,
        scaleY: 0,
        translateZ: 0,
    }, 50).velocity({
        height: diameterValue + 'px',
        width: diameterValue + 'px',
        top: -(diameterValue / 2) + 'px',
        left: -(diameterValue / 2) + 'px',
    }, 0);
}

var menu = document.querySelector('.nav__list');
var burger = document.querySelector('.burger');
var overlayNav = $('.cd-overlay-nav')
var overlayContent = $('.cd-overlay-content')
layerInit()
var openMenu = function() {
    burger.classList.toggle('burger--active');
    menu.classList.toggle('nav__list--active');
};

$(".burger").on("click", openMenu)
$(".nav__link").on("click", function(event) {
    loadEffect(event);
});

function loadEffect(event) {
    $(".cd-overlay-nav").css("left", event.clientX + "px");
    $(".cd-overlay-nav").css("top", event.clientY + "px");
    $(".cd-overlay-content").css("left", event.clientX + "px");
    $(".cd-overlay-content").css("top", event.clientY + "px");
    overlayNav.children('span').velocity({
        translateZ: 0,
        scaleX: 1,
        scaleY: 1,
    }, 600, 'easeInCubic', function() {
        if (typeof event.showThisOne != "undefined")
            loadPanel(event.showThisOne);
        else
            loadPanel(event.target);
        overlayNav.children('span').velocity({
            translateZ: 0,
            scaleX: 0,
            scaleY: 0,
        }, 0);
    });
}

function loadPanel(target) {
    $("#firstPage").add("#schedule").add("#fast").add("#history").add("#login").hide();
    if (typeof target == "string") {
        $("#" + target).fadeIn("fast");
        currentPanel = target;
        return;
    }
    if ($(target).hasClass("nav__link"))
        var icon = $(target).children("i");
    else
        var icon = $(target);
    if (icon.hasClass("fa-calendar-check-o")) {
        $("#schedule").fadeIn("fast");
        currentPanel = "schedule";
    } else if (icon.hasClass("fa-bolt")) {
        $("#fast").fadeIn("fast");
        currentPanel = "fast";
    } else if (icon.hasClass("fa-history")) {
        $("#history").fadeIn("fast");
        currentPanel = "history";
    } else if (icon.hasClass("fa-cog")) {
        $("#login").fadeIn("fast");
        currentPanel = "login";
    }
}

$(".button").click(function() {
    $(this).toggleClass("active");
    $(".icons").toggleClass("open");
});

$(".input__field--haruki").on("blur", function() {
    if ($(this).val() != "")
        $(this).next().children("span").css("visibility", "hidden");
    else
        $(this).next().children("span").css("visibility", "");
})

$("#s-person").add("#f-person").on("keydown", function(event) {
    if (event.keycode == 13) {
        if (currentPanel == "schedule")
            $("#s-person-button").click();
        else if (currentPanel == "fast")
            $("#f-person-button").click();
    }
})

$(".person-button").on("click", function() {
    var inputObj = $(this).parents(".row").find(".input__field--haruki").eq(1);
    var listObj = $(this).next(".person-lists");
	var person = inputObj.val();
	if(person == "") {
		showTempMsg("Input engineers' name.");
		return false;
	}
	var personLists = $(this).parents(".row").find(".one-person span:first-child");
	var duplicate = false;
	personLists.each(function(key) {
        if(personLists.eq(key).text() == person) {
			showTempMsg("You have input " + person);
			duplicate = true;
			return false;
		}
    })
	if(duplicate) {
		return false;
	}
    inputObj.addClass("animated fadeOutUpBig");
    setTimeout(function() {
        inputObj.val("");
        inputObj.blur();
        inputObj.removeClass("animated fadeOutUpBig");
        $("<div class='one-person'><span>" + person + "</span><div class='fa fa-close'></div></div>").appendTo(listObj).addClass("animated fadeInUpBig");
        $(".one-person .fa-close").on("click", function(event) {
            $(event.target).parents(".one-person").remove();
        })
    }, 200)
})

/****** Manage Process *******/
$(".start-stop").on("click", function() {
	if($(this).hasClass("fa-play-circle")) {
		if(conf[currentPanel].length == 0) {
			showTempMsg("No any task to be run. Just to add one.");
			return false;
		}
		manageProcess(currentPanel, "start");
		showStatus(currentPanel, "start");
	}
	else if($(this).hasClass("fa-stop-circle")) {
		manageProcess(currentPanel, "stop");
		showStatus(currentPanel, "stop");
	}
})

function manageProcess(mode, action) {
	if(action == "start") {
		if(mode == "schedule") {
			scheduleProcess = childProcess.fork("./app.js", [mode]);
			scheduleProcess.on("message", function(msg) {console.log("receive")
				handleMsg("schedule", scheduleProcess, msg);
			})
		}
		else if(mode == "fast") {
			fastProcess = childProcess.fork("./app.js", [mode]);
			fastProcess.on("message", function(msg) {
				handleMsg("fast", scheduleProcess, msg);
			})
		}
	}
	else if(action == "stop") {
		if(mode == "schedule" && typeof scheduleProcess != "undefined") {
			scheduleProcess.kill("SIGTERM");
		}
		else if(mode == "fast" && typeof fastProcess != "undefined") {
			fastProcess.kill("SIGTERM");
		}
	}

	function handleMsg(tMode, pro, obj) {
		if(obj.type == "error") {
			addMsg(obj.msg);
			pro = undefined;
		}
		else if(obj.type == "done") {
			addMsg(obj.msg);
			pro = undefined;
		}
		else if(obj.type == "status") {
			$(".running span").html(obj.msg + "%");
		}
	}
}

function showStatus(mode, flag) {
	var actionBtn = $("#" + mode).find(".start-stop");
	if(flag == "stop") {
		actionBtn.removeClass("fa-stop-circle");
		actionBtn.addClass("fa-play-circle");
		if(mode == "schedule") {
			$(".monitoring").slideUp();
		}
		else if(mode == "fast") {
			
			$(".running").slideUp();
		}
	}
	if(flag == "start") {
		actionBtn.removeClass("fa-play-circle");
		actionBtn.addClass("fa-stop-circle");
		if(mode == "schedule") {
			$(".monitoring").slideDown();
		}
		else if(mode == "fast") {
			$(".running span").html("0%");
			$(".running").slideDown();
		}
	}
}
/******************************/

/********* Action for checkbox **************/
$(".switch-box-input").on("change", function() {
    var id = $(this).attr("id");
    if ($(this).get(0).checked) {
        if (id.indexOf("close") != -1)
            $(this).parents(".switch-box").children(".switch-box-label").html("Close bug");
        else if (id.indexOf("assign") != -1)
            $(this).parents(".switch-box").children(".switch-box-label").html("Assign to sender");
    } else {
        if (id.indexOf("close") != -1)
            $(this).parents(".switch-box").children(".switch-box-label").html("Don't close bug");
        else if (id.indexOf("assign") != -1)
            $(this).parents(".switch-box").children(".switch-box-label").html("Don't assign to sender");
    }
})

var allCheckbox = $(".switch-box-input");
allCheckbox.each(function(key) {
        allCheckbox.eq(key).change();
    })
    /***********************************/

/***** manage Task and update config *******/
$(".add-task").on("click", function() {
    var panel = $(this).parents(".row");
    var oneTask = new Object();

    oneTask.project = panel.find(".input__field--haruki").eq(0).val();
    if (oneTask.project == "") {
        showTempMsg("Input or select one project you want to sync for.");
        return false;
    }
    oneTask.engineers = new Array();
    var personLists = panel.find(".person-lists").find(".one-person span:first-child");
    personLists.each(function(key) {
        oneTask.engineers.push(personLists.eq(key).text());
    })
    if (oneTask.engineers.length == 0) {
        showTempMsg("Input or select at lease one engineer you want to sync for.");
        return false;
    }
    if (currentPanel == "fast") {
        oneTask.beforeDays = $("#days").val();
        if (oneTask.beforeDays == "") {
            showTempMsg("Input the days value.");
            return false;
        }
    }
    if (panel.find(".switch-box-input").get(0).checked)
        oneTask.close = true;
    else
        oneTask.close = false;
    if (panel.find(".switch-box-input").get(1).checked)
        oneTask.assign = true;
    else
        oneTask.assign = false;
    oneTask.active = true;

    showOneNewTask(oneTask);
    updateTaskInConfig(currentPanel, "add", undefined, oneTask);
})

function initTaskShow() {
    for (let i in conf.fast) {
        showOneNewTask(conf.fast[i], "fast");
    }
    for (let i in conf.schedule) {
        showOneNewTask(conf.schedule[i], "schedule");
    }
}

function showOneNewTask(obj, targetPanel) {
    if (typeof targetPanel == "undefined")
        targetPanel = currentPanel;
    var addBtn = $(".add-task");
    if (targetPanel == "schedule") {
        var listTarget = $("#s-task-lists");
        var prefix = "s_switch_";
    } else if (targetPanel == "fast") {
        var listTarget = $("#f-task-lists");
        var prefix = "f_switch_";
    }
    var index = listTarget.children(".one-task").length;
    var id = prefix + index;
    taskConfMapping[id] = obj;
    addBtn.addClass("animated fadeOutRightBig");
    setTimeout(function() {
        var oneTask = "<div class='one-task'>";
        oneTask += "<div class='switch-box is-info'><input class='switch-box-input' type='checkbox' style='display:none;' id='" + id + "'";
        oneTask += obj.active ? " checked/>" : " />";
        oneTask += "<label for='" + id + "' class='switch-box-slider'></label></div><div class='fa fa-close'></div><span>";
        oneTask += obj.project + " | ";
        oneTask += obj.engineers.join(", ") + " | ";
        if (targetPanel == "fast") {
            if (obj.beforeDays == "0")
                oneTask += "Today | ";
            else
                oneTask += (parseInt(obj.beforeDays) + 1) + " days | ";
        }
        if (obj.close)
            oneTask += "Close | ";
        else
            oneTask += "Don't close | ";
        if (obj.assign)
            oneTask += "Assign";
        else
            oneTask += "Don't assign";
        oneTask += "</span></div>";

        if (targetPanel == "schedule")
            $(oneTask).appendTo("#s-task-lists").addClass("animated fadeInLeftBig");
        else if (targetPanel == "fast")
            $(oneTask).appendTo("#f-task-lists").addClass("animated fadeInLeftBig");

        $(".one-task .fa-close").on("click", function(event) {
            var getId = $(event.target).parents(".one-task").find(".switch-box-input").attr("id");
            var getIndex = getIndexFromConf(currentPanel, taskConfMapping[getId]);
            updateTaskInConfig(targetPanel, "delete", getIndex);
            $(event.target).parents(".one-task").remove();
        })

        $(".task-lists .switch-box-input").on("change", function(event) {
            var oneTask = taskConfMapping[$(event.target).attr("id")];
            if (typeof oneTask != "undefined") {
                var getIndex = getIndexFromConf(currentPanel, oneTask);
                updateTaskInConfig(currentPanel, "active", getIndex, $(this).get(0).checked);
            }
        })

        addBtn.removeClass("animated fadeOutRightBig");
        addBtn.addClass("animated fadeInLeftBig");
    }, 200);
}

function updateTaskInConfig(mode, action, index, value) {
    if (action == "delete") {
        index = parseInt(index);
        conf[mode].splice(index, 1);
    } else if (action == "add") {
        conf[mode].push(value);
    } else if (action == "active") {
        index = parseInt(index);
        conf[mode][index].active = value;
    }
    saveConfig();
}

function saveConfig() {
    ipcRenderer.send('update-settings', conf);
}

function conpareObject(ob1, ob2) {
    if (ob1.project == ob2.project) {
        for (let j in ob1.engineers) {
            if (ob2.engineers.indexOf(ob1.engineers[j]) == -1)
                return false;
        }
        for (let i in ob2.engineers) {
            if (ob1.engineers.indexOf(ob2.engineers[i]) == -1)
                return false;
        }
        if (typeof ob1.beforeDays != "undefined") {
            if (ob1.beforeDays != ob2.beforeDays)
                return false;
        }
        if (ob1.close != ob2.close || ob1.assign != ob2.assign)
            return false;
    } else {
        return false;
    }
    return true;
}

function getIndexFromConf(mode, obj) {
    var list = conf[mode];
    for (let i in list) {
        if (conpareObject(list[i], obj))
            return i;
    }

    return -1;
}
/*****************************/

/********* For alarm *********/
var msgBox = new Array();

function addMsg(oneMsg) {
    msgBox.push(oneMsg);
    switchMsg(false);
}

function switchMsg(switchNow) {
    if ((msgBox.length == 1 && $(".title-message > span").html() == "") || msgBox.length > 9 || switchNow) {
        if ($(".title-message > span").hasClass("bounceOutRight"))
            $(".title-message > span").removeClass("bounceOutRight");
        $(".title-message > span").html(!!msgBox[0] ? msgBox[0] : "");
        $(".title-message > span").addClass("bounceInRight");
        msgBox.splice(0, 1);
    }

    if (msgBox.length == 0)
        $(".message-num").fadeOut();
    else {
        $(".message-num span").html(msgBox.length);
        $(".message-num").add(".message-num span").fadeIn();
    }
}

function showTempMsg(msg) {
    var temp = $(".title-message > span").html();
    $(".title-message > span").html(msg);
    setTimeout(function() {
        if (temp == "" && msgBox.length > 0)
            switchMsg(true);
        else
            $(".title-message > span").html(temp);
    }, 5000);
}

$(".message-num > span").add(".title-message > .fa-bell").on("click", function() {
        switchMsg(true);
    })
    /******************************/