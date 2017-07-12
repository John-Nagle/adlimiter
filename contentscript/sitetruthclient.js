//
//  sitetruthclient.js  --  content script side interface to add on code for Mozilla page mod API
//
//  Browser-dependent - Mozilla
//
//  John Nagle
//  SiteTruth
//  October, 2011
//
//  This handles communication between the content script code running in the page's Javascript
//  environment and the privileged add-on code running in a separate container.
//
//  Most of this add-on uses code that also works with Greasemonkey.  This file contains the
//  content-script side code that's not Greasemonkey-compatible. 
//
//
//  Globals
//
"use strict";                                               // strict mode
var prefs = null;                                           // no prefs yet
var datadir = null;                                         // data directory of the add-on
var instanceid = Math.floor(Math.random()*1000000000);      // generate random ID for content script instance - Mozilla BUG 693345 check
var verbose = false;                                        // not verbose mode
//
//  Workarounds
//
//
//  checkurlchange -- check for change in document URL
//
//  Workaround for Mozilla bug 693345
//
var docurl = document.URL;                                      // URL of document being worked on

function checkurlchange()
{   var pdocumenturl = new Poly9.URLParser(document.URL);       // break apart URL
    var pdocurl = new Poly9.URLParser(docurl);                  // break apart URL
    if (pdocurl.getHost() != pdocumenturl.getHost())            // if document URL changed, bug
    {   console.error("ERROR: Mozilla BUG 693345: URL changed from " + docurl + " to " + document.URL);
        return(true);                                           // trouble
    }
    return(false);                                              // normal
}
//
//  proxyid  -- generate a proxy ID for serialization.   
//
//  Proxied items are not released until the proxyid object is released.
//  This could create a memory-growth problem for long-running pages.  
//
function ProxyID()
{
    this.proxyidseq = 0;                                    // serial number for unique ID
    this.idtoitem = {};                                     // id => item dictionary
};
//
//  getid  --  get ID for item
//
//  Adds the itemt to the items of the object.
//
ProxyID.prototype.getid = function(item) 
{   this.proxyidseq++;                                      // serialize
    this.idtoitem[this.proxyidseq] = item;                  // save this item
    return(this.proxyidseq);                                // return serial
};
//
//  getitem -- get item from ID.
//
//  Does not consume item.
//
ProxyID.prototype.getitem = function(id) 
{   var item = this.idtoitem[id];                           // get item, which should be present
    if (item === undefined || item === null)                // should always find
    {   console.error("SearchRater ProxyID: no proxy object stored for item #" + id); }
    ////delete this.idtoitem[id];                               // delete from cache
    return(item);                                           // return item
};
//
//  delitem -- get item from ID.
//
//  Done with this proxy item
//
ProxyID.prototype.delitem = function(id) 
{   var item = this.idtoitem[id];                           // get item, which should be present
    if (item === undefined || item === null)                // should always find
    {   console.error("SearchRater ProxyID delete: no proxy object stored for item #" + id); }
    delete this.idtoitem[id];                               // delete from cache
};

//
//  startcontentscript -- starts the content script
//
function startcontentscript()
{   var msg = self.options;                                             // get options from PageMod
    prefs = msg.prefs;                                                  // extract prefs
    datadir = msg.datadir;                                              // data directory of the add-on
    verbose = prefs.verbosepref;                                        // set verbose flag
    startratings(document);                                             // start the rating process
}
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
var proxyids = new ProxyID();                                           // storage for proxies for items sent to server

//
//  querySiteTruthCache  --  query cache only.
//
//  Message "ratecachereq" => "ratecachereply"
//
function querySiteTruthCache(rateitems, ratedcallback)
{
    var domains = Object.keys(rateitems);                               // array of domains of interest   
    var id = proxyids.getid({rateitems: rateitems, ratedcallback: ratedcallback});  // we'll need this at the callback
    var query = { id: id, domains: domains};                            // parameters to serialize
    self.port.emit("ratecachereq", query);                              // send to server in JSON format
}
//
//  querySiteTruthCacheReply  --  reply from cache query
//
function querySiteTruthCacheReply(replymsg)
{
    var proxy = proxyids.getitem(replymsg.id);                          // get our local proxy object
    proxyids.delitem(replymsg.id);                                      // done with it, one send, one receive
    if (prefs.verbosepref) { console.log("querySiteTruthCacheReply: " + JSON.stringify(replymsg)); }           // debug 
    proxy.ratedcallback(replymsg.reply);                                // callback with reply
}
//
//  querySiteTruthSserver --  query rating server and cache.
//
//  "ratedcallback" will be called for each item rated, which may take time as
//  ratings come in from the server.
//
//  Message: "ratereq" => "ratereply"
//
function querySiteTruthServer(rateitems, ratedcallback, extraargs)      // external call, no retry count
{   querySiteTruthServerTry(rateitems, ratedcallback, extraargs, kmaxretries) } // call with retry count

function querySiteTruthServerTry(rateitems, ratedcallback, extraargs, retriesleft)  // internal call, with retry count
{   
    var domains = Object.keys(rateitems);                               // array of domains of interest   
    if (prefs.verbosepref) 
    {   console.log("querySiteTruthServerTry domains: " + domains); 
        console.log("Instance #" + instanceid + "  check of document.URL: " + document.URL);  // Mozila BUG 693345 check
    }
    if (domains.length == 0) return;                                    // nothing to do
    var id = proxyids.getid({rateitems: rateitems, ratedcallback: ratedcallback, retriesleft: retriesleft});  // we'll need this at the callback
    var query = { id: id, domains: domains, extraargs: extraargs };     // parameters to serialize
    self.port.emit("ratereq", query);                                   // send to server in JSON format
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
    
self.port.on("ratereply", querySiteTruthServerReply);                   // set up reply connection
self.port.on("ratecachereply", querySiteTruthCacheReply);               // set up reply connection
