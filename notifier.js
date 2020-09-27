//
//  notifier.js -- Background script
//
//  All this does is display notifications
//  when told to do so by the content script.
//
//  Configuration
//
const NOTIFYINTERVALSECS = 120;                     // minimum interval between notifications
const POPUPURL = "popup/opt-in.html";               // URL to pop up
const OPTINSTORAGE = "optIn";                       // name of opt-in storage tag.
//
//  notify -- pick up notification msg and display, not too frequently
//
var lastnotifytime = 0;                                                 // to prevent excessive notifications

function notify(message) {
    console.log("Notification: " + message);                            // ***TEMP***
    var now = Math.floor(Date.now() / 1000);                            // time in secs
    var age = now - lastnotifytime;                                     // time since last notification
    if (age < NOTIFYINTERVALSECS) return;                               // too soon to bother user
    lastnotifytime = now;
    browser.notifications.create({                                      // post notification
        "type": "basic",
        "iconUrl": browser.extension.getURL("images/sitetruthicon-32.png"),
        "title": "Ad Limiter problem",
        "message": message
        });
}
//
browser.runtime.onMessage.addListener(notify);                          // connect fn to event

browser.storage.local.set({ OPTINSTORAGE : false, "optInShown" : false });   // ***TEMP*** clear every time for test
//  
//  Opt-in interface. Brings up a popup.
//
browser.runtime.onMessage.addListener(function(message, sender) {
  // check storage for opt in
  browser.storage.local.get(OPTINSTORAGE)
  .then(function(result) { browser.tabs.sendMessage(sender.tab.id, {OPTINSTORAGE : (true == result.optIn)}); },
        function(result) { browser.tabs.sendMessage(sender.tab.id, {OPTINSTORAGE : false});});
  
});

function showoptinpopup()
{
    browser.tabs.create({ url: POPUPURL });
}

// show the tab if we haven't registered the user reacting to the prompt.
browser.storage.local.get("optInShown")
    .then(function(result) { if (!result.optInShown) { showoptinpopup(); }}, showoptinpopup);


////console.log("AdLimiter background loaded.");                            // ***TEMP***
