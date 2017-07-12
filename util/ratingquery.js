//
//  ratingquery.js  --  Query code for use inside Mozilla add-ons.
//
//  Part of SiteTruth "siterater" plug-in.
//
//  John Nagle
//  SiteTruth
//  October, 2011
//
//  This code calls the SiteTruth rating API defined in
//  http://www.sitetruth.com/doc/sitetruthapi.html
//
//  As of SDK 1.14, does not run in private browsing mode.
//
//  TODO:
//
//  Imports
//
"use strict";                                           // strict mode
const mrequest = require('sdk/request');                // HTTP request module
const msimplestorage = require("sdk/simple-storage");   // for cache
const mpagemod = require("sdk/page-mod");               // page mod API
const mnotifications = require("sdk/notifications");    // notifications API
const mpreferences = require("sdk/simple-prefs");       // simple prefs API
const mselfdata = require("sdk/self").data;				// where this add-on lives

//
//      Configuration
//
//      Configuration - DUPLICATE of sitetruthconfig.js
//
//      We can't share these from a configuration-independent file,
//      because we need "export", which is Mozilla-only.
//
var stsite = "http://www.sitetruth.com";        // base URL of SiteTruth site
var stfcgibase = stsite + "/fcgi/";             // location of FCGI programs
var strateprefix = stfcgibase + "rateapiv3.fcgi";    // API URL for queries
var kcachettl = 60*60*24*7;                     // Lifetime of cache entries, seconds
var kaddonname = "Ad Limiter";                  // name of the add-on for display

//
//  getprefs -- get preferences
//
function getprefs() {
    var prefs = {                               // add-on options fetch
        "adpref" : mpreferences.prefs["adpref"],
        "searchpref" : mpreferences.prefs["searchpref"],
        "outlinepref" : mpreferences.prefs["outlinepref"],
        "verbosepref" : mpreferences.prefs["verbosepref"]};
    return(prefs);      
}
//
//	enablesiterating --  Set up page mod environment
//
//  Initialization - called from main.js
//
//	Files in ContentScriptURL are loaded into the Javascript environment of the
//	web page.  Then the contentScript sting is loaded into that environment and
//	executed.  For each page started, onAttach is called, and runs in the 
//	add-on environment.
//
exports.enablesiterating = function enablesiterating(includeurls, clientmodules, prefsidin) 
{   //prefsid = prefsidin;                                                        // save preferences ID, which is a constant
    mpagemod.PageMod({
        include: includeurls,												    // URL recognition patterns
        contentScriptWhen: 'end',												// run after loading complete
        contentScriptFile : clientmodules.map(mselfdata.url),					// load all client modules from list
        contentScriptOptions: {prefs: getprefs(), datadir: mselfdata.url("")},  // send params to content script
        contentScript: 'startcontentscript();',								    // start the rating process after loading code
        onAttach: function onAttach(worker) {
            worker.port.on('ratereq',                                           // each page gets its own worker closure
                function(msg)                                                   // called for each incoming msg from content script
                {   ratedomains(worker.port, msg); }                            // send request out for processing
                );                                                              // attach rating function to channel
            worker.port.on('ratecachereq',                                      // each page gets its own worker closure
                function(msg)                                                   // called for each incoming msg from content script
                {   ratecacheddomains(worker.port, msg); }                      // send request out for processing
                );                                                              // attach rating function to channel
    }});
}

//
//  ratecacheddomains  --  maka a rate request of the server
//  
//  Input is a JSON request from the content script.
//  Output is a JSON reply on the port.
//
//  Message "ratecachereq" => "ratecachereply".
//
//  One request produces exactly one reply
//
function ratecacheddomains(port, params)
{
    var domains = params.domains;
    var domainresults = {}                                          // results to return
    for (var i=0; i < domains.length; i++)                          // for all domains in query
    {   var domain = domains[i];                                    // get domain
        domainresults[domain] = searchdomaincache(domain);          // check cache
    }
    port.emit("ratecachereply", {id: params.id, reply: domainresults});     // reply with cache results
}
//
//  ratedomains  --  maka a rate request of the server
//  
//  Input is a JSON request from the content script.
//  Output is a JSON reply on the port.
//
//  Message "ratereq" => "ratereply".
//
//  One ratereq may producce more than one ratereply.  The last one has
//  "done" set to true.
//
function ratedomains(port, params)
{   var prefs = getprefs();                                 // get preferences object
    var verbose = prefs.verbosepref;                        // get verbose pref
    if (verbose) console.log("Rate domains: " + params.domains);  // domains being rated
    var replyitems = [];                                    // reply items to return to sender
    //  Check cache first, and eliminate any known domains
    var domains = {};                                       // domains which need to be rated
    for (var i=0; i < params.domains.length; i++)           // check for rating available in cache
    {   var domain = params.domains[i];
        var item = searchdomaincache(domain);               // look in cache
        if (item)                                           // if found in cache
        {   replyitems.push({domain: domain, rating: item.rating, ratingreply: item});
            continue
        }
        if (verbose) console.log("Not found in cache: " + domain);
        domains[domain] = true;                             // not in cache, must look up
    }
    var noserverquery = Object.keys(domains).length == 0;   // true if we need to query the server
    if (replyitems.length > 0)
    {   port.emit("ratereply", {id: params.id, reply: replyitems, done: noserverquery}); }
    if (noserverquery) return;                              // found all in cache, done.
    //  Not in cache, must query server for rating.
    var queryurl = buildSiteTruthQuery(domains, params.extraargs);
    if (verbose)
    {   console.log("Query to server: " + queryurl);  }     // debug info
    var httprequest = mrequest.Request({
        url: queryurl,
        headers: {
            'User-agent': 'SiteTruth.com Mozilla add-on',
            'Accept': 'application/json'
        },
        onComplete: function (response) {
            ratingCallback(port, params, domains, response);        // handle the response
            }
    });
    httprequest.get();                                              // make the request - no reply
}

//
//    buildSiteTruthQuery  -- build a SiteTruth query url
//
//    Format is:
//        http://www.sitetruth.com/fcgi/rateapiv1.fcgi?url="urla"&url="urlb"&...
//
//    This query URL will query the database, and start a rating if necessary
//    Retry every 5 seconds if status is 202; a rating is in progress.
//
//    Input is an associative array indexed by domain name.
//    Extraargs is an associative array of the form {key: value, ... }
//
function buildSiteTruthQuery(queries, extraargs)
{   var result = strateprefix;                                      // standard API, V2, with JSON support
    var nodata = true;                                              // if no data yet
    for (var domain in queries)                                     // get all domains in query
    {   if (queries[domain] === null) { continue; }                 // skip nulls
        if (nodata)                                                 // if no data yet
        {    result += "?"; nodata = false; }                       // first field gets "?"
        else
        {    result += "&"; }                                       // later fields get "&"
        result += "url=" + encodeURIComponent(domain);              // add next component
    }
    if (nodata) { return(null); }                                   // return null if no items
    if (extraargs !== null)                                         // add additional args
    {   for (var key in extraargs)                                  // add additional fields
        {    result += "&" + encodeURIComponent(key) + "=" +        // add "key=value" to URI
                encodeURIComponent(extraargs[key]); 
        }
    }
    result += '&format=json';                                       // request JSON output
    return(result);                                                 // return URL, ready for net
}
//
//    ratingCallback  --  callback after server rating request completion
//
//    Some items may have been rated, some not; the caller have to ask again.
//
function ratingCallback(port, params, domains, response)
{
    //  Purge cache if necessary.
    cachepurge(kcachettl);
    //  
    var prefs = getprefs();                                             // get preferences object
    var status = response.status;                                       // get response status
    if (status != 200)                                                  // if trouble
    {   console.error("SiteTruth query failed: " + status + " (" + response.statusText + ")");
        for (var domain in domains)                                     // Failure puts a grey circle on all items.
        {   var dummyreply = {id: params.id, reply: [{domain: domain, rating: "U", ratingreply: {ratinginfo: "error"}, done: true}]}; // dummy reply
            port.emit("ratereply", dummyreply);                         // return the dummy reply
        }
        if (status == 403)                                              // "Forbidden"
        {   var msg1 = "The SiteTruth rating access key (" + extraargs["key"] + ") is not valid.";
            notify(msg1 + "\nPlease check for a later version of this browser add-on.");
            return;
        }
        if (status == 410)                                              // "Gone"
        {   notify("The SiteTruth API version used is obsolete.\nPlease check for a later version of this browser add-on.");
            return;
        }
        notify("SiteTruth ratings are temporarily unavailable. (HTTP error " + status + " connecting to server.)"); 
        return;                                                         // fails
    }
    //
    var verbose = prefs.verbosepref;                                    // get verbose pref
    if (verbose)
    {   console.log("SiteTruth reply:\n" + response.text);    }         // actual text of reply
    var responsemsg = response.json;                                    // parse result from JSON
    if (!(Object.prototype.toString.call(responsemsg) === '[object Array]')) // if reply not an array of ratings
    {   console.error("SiteTruth server reply was not an array of ratings: " + response.text);   // server broken, or public net authentication problem
        responsemsg = [];                                               // treat as no ratings returned, which will cause a retry
    }
    var reply = { id: params.id, reply: responsemsg, done: true}        // add param ID to identify proxy at receiving end, and send prefs
    port.emit("ratereply", reply)                                       // send to content script
    for (var i=0; i < responsemsg.length; i++)                          // Cache update
    {   var ratingitem = responsemsg[i];                                // get one rating result from JSON array
        if (ratingitem.status == "200")                                 // if good result
        {    updatedomaincache(ratingitem.domain, ratingitem.rating, ratingitem);   // cache for future use
        }
    }
    return                                                              // done
}
//
//  notify  --  put up notification
//
//  This is for errors. No more than one notification will appear per knotifysecs interval.
//
var lastnotify = null;                                                  // time of last notify
var knotifysecs = 180;                                                  // minimum time between notifies
function notify(msg)
{
    var now = nowsecs();                                                // if last notification
    if (lastnotify && now - lastnotify < knotifysecs)                   // if too soon
    {   console.error(msg);                                             // just log
        return;
    }
    mnotifications.notify({                                             // give user a notification
        title: kaddonname,                                              // name in notification
        text: msg,
    });
    lastnotify = now;                                                   // timestamp of last time we annoyed user
}
//
//    nowsecs  --  time now in seconds since epoch, as with UNIX time.
//
//    This ought to be standard.
//
function nowsecs()
{   var now = new Date();                            // current data object
    return(Math.round(now.getTime() / 1000));        // return secs since epoch                
}
//
//    General purpose cache for Greasemonkey
//
//    Stored in Mozilla simple storage
//
if (msimplestorage.storage.ratingcache === undefined)   // if cache does not exist yet
{   msimplestorage.storage.ratingcache = {}             // set it up
    msimplestorage.storage.lastcachepurgetime = nowsecs();
    ////console.log("SearchRater cache created.");
}
//
//    Internal fomrmat is:
//    
//        ttl,value
//
//    cachesearch --  look up entry in cache
//
function cachesearch(key)
{
    var item = msimplestorage.storage.ratingcache[key];               // get by key
    if (item === undefined) { return(null);  }          // no find
    if (item === null)    { return(null); }             // no find
    ////console.log("Cache info: " + val);                   // ***TEMP***
    var ttl = item.ttl - nowsecs();                     // time to live in seconds
    ////console.log("Cache find " + key + " ttl: " + ttl);       // ***TEMP***
    //  Check for obsolete item format - no ratingreply
    if (item.ratingreply === undefined)                 // if cache item is from an older version
    {   ttl = -1; }                                     // expire and flush item
    if (ttl < 0)                                        // if expired
    {   delete(msimplestorage.storage.ratingcache[key]);// delete expired item
        return(null);                                   // return null
    }
    return(item);                                       // return item, whic is a dict.
}
//
//    cachedupdate  --  update entry in cache
//
function cacheupdate(key, item, ttlsecs)
{   item.ttl = nowsecs() + ttlsecs;
    msimplestorage.storage.ratingcache[key] = item;     // insert item
}
//
//  cachepurge -- purge all obsolete items
//
//  Every "ttlsecs", all old entries are purged.
//
function cachepurge(ttlsecs)
{   var now = nowsecs();
    if (msimplestorage.storage.lastcachepurgetime + ttlsecs > now)  // no purge
    {   return; }                                                   // no purge
    var prefs = getprefs();                         // get preferences object
    if (prefs.verbose) 
    {   console.log("Note: purged old SiteTruth ratings from cache at time " + nowsecs() + ".");    }
    for (var key in msimplestorage.storage.ratingcache) // for all keys
    {    cachesearch(key);   }                      // this will delete obsolete values
    msimplestorage.storage.lastcachepurgetime = now;// time of last purge is now
}
//
//  Cache overflow handling.  This is unlikely, but should be handled.
//
msimplestorage.on("OverQuota", function () 
    {   msimplestorage.storage.ratingcache = {}     // clear cache
        console.error("SearchRater cache overflowed.  Cache cleared.");
    }
);
//
//    Use of cache for SiteTruth rating
//
function updatedomaincache(domain, rating, ratingreply)
{    cacheupdate(domain, {rating: rating, ratingreply: ratingreply}, kcachettl);    }    // update cache
//
//    checkdomaincache  --  check in cache.
//
//    Returns {rating: rating, ratingreply: ratingreply} or null.
//
function searchdomaincache(domain)
{    
    return(cachesearch(domain));                    // return rating, ratingreply
}