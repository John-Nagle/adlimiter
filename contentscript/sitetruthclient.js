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
var prefs = null;                                           // no prefs yet
var datadir = stimagebase;                                  // image directory of the add-on

//
//  startcontentscript -- starts the content script
//
function startcontentscript()
{   ////var msg = self.options;                                             // get options from PageMod
    prefs = kdefaultprefs;                                              // ***TEMP*** use canned prefs
    ////prefs = msg.prefs;                                                  // extract prefs
    ////datadir = msg.datadir;                                              // data directory of the add-on
    ////verbose = prefs.verbosepref;                                        // set verbose flag
    prefs.verbosepref = true;                                                     // ***TEMP***
    startratings(document);                                             // start the rating process
}

function checkurlchange() {}                                            // OBSOLETE
//
//
//    querySiteTruthServer  --  general query request generator, Greasemonkey mode
//
//    rateitems form is:
//        { domain : elts, domain : elts, ... }
//
//    ratedcallback form is:
//        callbackfn(elts, domain, rating, ratinginfo)
//
//    extrargs form is:
//        { argname : value, argname : value ...)
//    and adds additional args to the query URL.  The usual value for
//    extraargs is { key: "guest" }
//
//    Use this generic version in all Javascript clients.
//

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
//  querySiteTruthSserver --  query rating server and cache.
//
//  "ratedcallback" will be called for each item rated, which may take time as
//  ratings come in from the server.
//
//  Message: "ratereq" => "ratereply"
//  ***NEEDS WORK FOR WEBEXTENSIONS***
//
function querySiteTruthServer(rateitems, ratedcallback, extraargs)      // external call, no retry count
{   querySiteTruthServerTry(rateitems, ratedcallback, extraargs, kmaxretries) } // call with retry count

function querySiteTruthServerTry(rateitems, ratedcallback, extraargs, retriesleft)  // internal call, with retry count
{   
    var domains = Object.keys(rateitems);                               // array of domains of interest   
    if (prefs.verbosepref) 
    {   console.log("querySiteTruthServerTry domains: " + domains); 
    }
    if (domains.length == 0) return;                                    // nothing to do    
    var queryurl = buildSiteTruthQuery(domains, extraargs);             // build the query URL
    console.log("Query URL: " + queryurl);                              // show the query URL
    var req = new XMLHttpRequest();                                     // to "sitetruth.com"
    function reqListener () {                                           // ***TEMP**
        console.log("XMLHttp Response: " + this.responseText);
    }
    ///req.addEventListener("load", reqListener);
    ////req.onload = reqListener;
    req.addEventListener("load", reqListener);
    req.open("GET", queryurl);
    req.send();
};
//
//  querySiteTruthServerReply --  Communication from add-on code.
//
//  Each reply is the rating for one domain. Reply format is JSON of
//  {id: params.id, [{domain: domain, rating: "Q", ratinginfo: "", err: ""}]}
//
//  For each reply, we must call 
//   callbackfn(elt, domain, rating, ratinginfo)
//
function querySiteTruthServerReply(replymsg)
{              
    var proxy = proxyids.getitem(replymsg.id);                          // get our local proxy object
    var replyarray = replymsg.reply;                                    // all the reply items
    var rerateitems = {}                                                // domains needing further work
    ////prefs.verbosepref = true    // ***TEMP***
    if (prefs.verbosepref) { console.log("querySiteTruthServerReply: " + JSON.stringify(replymsg)); }           // debug  
    if (replymsg.done)                                                  // if last use of proxy object
    {   proxyids.delitem(replymsg.id);  }                               // delete ref to it to avoid memory leak
    for (var i=0; i < replyarray.length; i++)                           // for all items in reply
    {   var reply = replyarray[i];                                      // one item in reply
        var elts = proxy.rateitems[reply.domain];                       // get elt 
        if (reply.status == "202")                                      // if must try again
        {   if (proxy.retriesleft > 0)                                  // if we can retry
            {   rerateitems[reply.domain] = elts;                       // make new to-do list
                continue;                                               // don't need to touch visible icon
                ////reply.rating = 'W';                                     // In-progress symbol
                ////reply.ratinginfo = 'rating...';                         // Rating in progress
            } else {
            //  No more retries. Return dummy result
                reply.rating = 'U';                                     // grey circle
                reply.ratinginfo = 'timeout';                           // status is timeout
            }
        } 
        proxy.ratedcallback(elts, reply.domain, reply.rating, reply);  // this will place rating icons in DOM
    }
    //  Handle domains which need to be tried again.  We do this on in the content script
    //  so that if the page is closed, no more requests are made of the SiteTruth server.
    if (Object.keys(rerateitems).length > 0)                            // if rerate hash not empty                                                     // if anything needs a retry
    {   if (prefs.verbosepref) console.log("Domains pending rerating: " + Object.keys(rerateitems));   // debug output
        //    Retry any ratings in 202 status after a 5 second delay.
        //    Create a closure for the timer callback
        window.setTimeout(function() 
            {     querySiteTruthServerTry(rerateitems, proxy.ratedcallback, proxy.extraargs, proxy.retriesleft-1); },
                kretrysecs*1000);
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

