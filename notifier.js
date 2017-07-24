//
//  notifier.js -- Background script
//
//  All this does is display notifications
//  when told to do so by the content script.
//
//  Configuration
//
const NOTIFYINTERVALSECS = 120;                     // minimum interval between notifications
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
console.log("AdLimiter background loaded.");                            // ***TEMP***
