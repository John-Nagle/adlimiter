//
//  sitetruthclient.js  --  content script side interface to add on code for Mozilla page mod API
//
//  WebExtensions version
//
//  John Nagle
//  SiteTruth
//  October, 2017
//
//
//
//  Globals
//
"use strict";                                               // strict mode
var prefs = Object.assign({},KDEFAULTPREFS);                // Use default prefs if none read yet
var datadir = stimagebase;                                  // image directory of the add-on


//
//  startcontentscript -- starts the content script
//
function startcontentscript(patternlist)
{   
    if (browser.extension.inIncognitoContext) return;       // don't run if in incognito tab, for privacy
    if (!matchpatternlist(patternlist, document.baseURI)) return;      // ignore if doesn't match patterns
    function gotprefs(item) {                               // got prefs
        loadprefs(item);                                    // load pref data
        startratings(document);                             // then rate
    }
    //  This is to handle a race condition where the user has not answered the opt-in popup yet.
    function gotoptin(item) {                               // got opt in
        var optinval = item["optIn"];                       // the value for that key
        if (optinval != true)                               // must be true
        {   console.log("Opt-in popup decision pending");   // user has opt-in window and search open an the same time, probably. Can't run addon before opt-in.
            return;
        }           
        browser.storage.local.get(KPREFSKEY).then(gotprefs, storageerror);  // first get prefs
    }
    browser.storage.local.get("optIn").then(gotoptin, function() { console.log("No optin yet"); gotoptin(false)}); // if no opt in stored, treat as false
}

function checkurlchange() {}                                // OBSOLETE - present to avoid modifying other code
//
//  querySiteTruthCache  --  query cache only.
//
//  Done within the content script, using a promise and callback.
//
function querySiteTruthCache(rateitems, ratedcallback)
{
    var domains = Object.keys(rateitems);                               // array of domains of interest  
    cachesearch(domains, ratedcallback);                                // do the search and get called back 
}
//
//  notify -- post notification
//
//  Can't do this from a content script. 
//
function notify(msg) {
    ////console.log("Notification sent: " + msg);                                // ***TEMP***
    browser.runtime.sendMessage(msg);                                   // send to base for notification
    }
//
//  querySiteTruthSserver --  query rating server and cache.
//
//  "ratedcallback" will be called for each item rated, which may take time as
//  ratings come in from the server.
//
//
function querySiteTruthServer(rateitems, ratedcallback, extraargs)      // external call, no retry count
{   querySiteTruthServerTry(rateitems, ratedcallback, extraargs, KMAXRETRIES) } // call with retry count

function querySiteTruthServerTry(rateitems, ratedcallback, extraargs, retriesleft)  // internal call, with retry count
{   
    var domains = Object.keys(rateitems);                               // array of domains of interest   
    if (prefs.verbosepref) 
    {   console.log("querySiteTruthServerTry domains: " + domains); 
    }
    if (domains.length == 0) return;                                    // nothing to do    
    var queryurl = buildSiteTruthQuery(domains, extraargs);             // build the query URL
    //  reqFail -- report failure of query 
    function reqfailreport(status, statustext) {
        console.error("SiteTruth query failed: " + status + " (" + statustext + ")");
        var replyarray = [];                                            // no reply array yet    
        for (let domain of domains)                                     // Failure puts a grey circle on all items.
        {   var dummyreply = {domain: domain, rating: "U", ratingreply: {ratinginfo: "error"}, done: true}; 
            replyarray.push(dummyreply);                                // generate dummy replies
        }
        siteTruthServerReply(replyarray, rateitems, ratedcallback, extraargs, retriesleft); // handle reply
    }
    //  reqComplete -- callback from XMLHttpRequest
    function reqComplete () {                                           // closure for callback
        var replyarray = [];                                            // no reply array yet    
        var status = this.status;                                       // get response status
        if (status != 200)                                              // if trouble
        {   if (status == 403)                                          // "Forbidden"
            {   var msg1 = "The SiteTruth rating access key (" + extraargs["key"] + ") is not valid.";
                notify(msg1 + "\nPlease check for a later version of this browser add-on.");
                return;
            } else if (status == 410)                                          // "Gone"
            {   notify("The SiteTruth API version used is obsolete.\nPlease check for a later version of this browser add-on.");
                return;
            } else {
                notify("SiteTruth ratings are temporarily unavailable. (HTTP error " + status + " connecting to server.)");
            } 
            reqfailreport(status, this.statustext);                     // deal with failure
            return;                                                     // fails
        }                                                               // good case
            ////console.log("XMLHttp Response: " + this.responseText);
        try {
            var replyarray = JSON.parse(this.responseText);             // parse JSON into an array
        }
        catch (e) {
            notify("Unable to connect to SiteTruth API properly. Not receiving valid replies.");
            reqfailreport(299, "Invalid JSON");
        }
        //  Success
        siteTruthServerReply(replyarray, rateitems, ratedcallback, extraargs, retriesleft); // handle reply
    }
    //  reqTimeout - timed out
    function reqTimeout() {                                             // closure for timeout
        this.status = 408;                                              // use timeout status
        reqComplete();                                                  // handle as error
    }
    var req = new XMLHttpRequest();                                     // make request to "sitetruth.com"
    req.onload = reqComplete;
    req.timeout = QUERYTIMEOUTSECS * 1000;                              // timeout is in milliseconds
    req.ontimeout = reqTimeout;
    req.open("GET", queryurl);
    req.send();                                                         // query Sitetruth server.
};
//
//  siteTruthServerReply --  Communication from add-on code.
//
//  Each reply is the rating for one domain. Reply format is JSON of
//  {id: params.id, [{domain: domain, rating: "Q", ratinginfo: "", err: ""}]}
//
//  For each reply, we must call 
//   callbackfn(elt, domain, rating, ratinginfo)
//
function siteTruthServerReply(replyarray, rateitems, ratedcallback, extraargs, retriesleft)
{
    var rerateitems = {}                                                // domains needing further work
    var cacheinserts = {};                                              // to be inserted in cache
    if (prefs.verbosepref) { console.log("querySiteTruthServerReply: " + JSON.stringify(replyarray)); }           // debug  
    for (let ratingitem of replyarray)                                  // for all items in reply
    {   var elts = rateitems[ratingitem.domain];                        // get elt 
        if (ratingitem.status == "202")                                 // if must try again
        {   if (retriesleft > 0)                                        // if we can retry
            {   rerateitems[ratingitem.domain] = elts;                  // make new to-do list
                continue;                                               // don't need to touch visible icon
                ////ratingitem.rating = 'W';                            // In-progress symbol
                ////ratingitem.ratinginfo = 'rating...';                // Rating in progress
            } else {
            //  No more retries. Return dummy result
                ratingitem.rating = 'U';                                // grey circle
                ratingitem.ratinginfo = 'timeout';                      // status is timeout
            }
        }
        if (ratingitem.status == "200")                                 // if success
        {   cacheinserts[ratingitem.domain] = ratingitem;  }            // add to cache      
        ratedcallback(elts, ratingitem.domain, ratingitem.rating, ratingitem);  // this will place rating icons in DOM
    }
    updatedomaincache(cacheinserts);                                    // update domain cache
    //  Handle domains which need to be tried again.  We do this on in the content script
    //  so that if the page is closed, no more requests are made of the SiteTruth server.
    if (Object.keys(rerateitems).length > 0)                            // if rerate hash not empty                                                     // if anything needs a retry
    {   if (prefs.verbosepref) console.log("Domains pending rerating: " + Object.keys(rerateitems));   // debug output
        //    Retry any ratings in 202 status after a 5 second delay.
        //    Create a closure for the timer callback
        window.setTimeout(function() 
            {     querySiteTruthServerTry(rerateitems, ratedcallback, extraargs, retriesleft-1); },
                KRETRYSECS*1000);
    }
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
//    Input is an array of domain names.
//    Extraargs is an associative array of the form {key: value, ... }
//
function buildSiteTruthQuery(queries, extraargs)
{   var result = strateprefix;                                      // standard API, V3, with JSON support
    var nodata = true;                                              // if no data yet
    for (let domain of queries)                                     // get all domains in query
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
//  matchpatternlist -- match URL against list of regular expressions
//
function matchpatternlist(patternlist, url) {
    ////console.log("URL: " + url);                                     // ***TEMP***
    for (let pat of patternlist) {                                  // pattern list
        var matched = pat.test(url);                                // does it match?
        ////console.log("Testing (" + matched + ") " + pat);                                           // ***TEMP***
        if (matched) return(true);
    }
    ////console.log("No match");                                        // ***TEMP***
    return(false);                                                  // no match
    
}
//
//  loadprefs -- set preference settings from JSON from storage
//
function loadprefs(item) {
    var prefstr = item[KPREFSKEY];				                    // get prefs
	////console.log("Prefs at page processing start: " + prefstr);      // ***TEMP***
    if (prefstr === undefined || prefstr === null) return;	        // if no stored prefs, skip
    var prefwork = JSON.parse(prefstr);					            // parse prefs, which are a JSON string
    if (prefwork === undefined || prefwork === null) return;	    // if no stored prefs, skip
    prefs = prefwork;                                               // set global prefs
}


