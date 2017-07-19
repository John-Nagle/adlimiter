//
//  General purpose cache, stored in WebExtensions simple storage
//
//
//  Part of SiteTruth add-ons.
//  John Nagle
//  July, 2017
//
"use strict";                                       // strict mode
//
//  Initialization
//
const LASTCACHEPURGETIME = "T";                     // prefixes for storage keys
const RATINGPREFIX = "R-";

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
//  storageset -- store typed keys and values
//
//  Returns a promise.
//
function storageset(type, keyvaluepairs) {
    var updates = {}
    for (var key in keyvaluepairs) {
        // construct storage key, because storage has no namespacing
        updates[type + key] = keyvaluepairs[key];
    }
    return(browser.storage.local.set(updates));              
}
//
//  storageget --  get values for list of typed keys.
//  
//  Returns a promise of an array
//
function storageget(type, keys)
{   
    var queries = []                                        // build cache queries
    for (let key of keys) {                                 // for all keys
       if (key === null || key === undefined) continue;     // skip duds
       queries.push(type + key);                            // queries must be prefixed with type
    }
    if (queries.length == 0) return(Promise.resolve({}));   // nothing to ask, return an empty object
    console.log("Calling browser.storage.local.get for " + queries);    // ***TEMP***
    return(browser.storage.local.get(queries));             // return promise
}
//  
//  storageerror
// 
function storageerror(error) {
    console.log(`Browse storage error: ${error}`);
}


////if (msimplestorage.storage.ratingcache === undefined)   // if cache does not exist yet
////{   msimplestorage.storage.ratingcache = {}             // set it up
 ////   msimplestorage.storage.lastcachepurgetime = nowsecs();
 ////   ////console.log("SearchRater cache created.");
////}

//
//    Internal format is:
//    
//        { ttl: time, ratingreply: value }
//
//    cachesearch --  look up entries in cache, get called back on find or no find with array of results.
//
function cachesearch(domains, callback)
{
    function found(items) {                             // called by promise
        console.log("browser.storage.local.get returned " + JSON.stringify(items)); // ***TEMP***
        var result = {};                                // result is a set of key:value pairs
        var now = nowsecs();                            // time now
        for (var key in items)                          // for all keys in result
        {   var val = items[key];                       // get value 
            if (val === undefined || 
                val === null || 
                val.ratingreply === undefined ||
                val.ratingreply === null ||             // null in storage
                val.ratingreply.domain === undefined)   // domain must be valid
            {   storage.local.remove(key);              // remove junk entry
                continue;
            }
            var ttl =  val.ttl - now;                   // time to live in seconds
            if (ttl < 0)                                // if expired
            {   storage.local.remove(key);              // get rid of expired item asynchronously
                continue;
            }
            result[val.ratingreply.domain] = {rating: val.ratingreply.rating, ratingreply: val.ratingreply };       // return stored rating reply
        }
        //  Found data
        callback(result);                               // return { domain: ratingreply ... }     
    }
    storageget(RATINGPREFIX, domains).then(found, storageerror);          // query, get promise
}
    
/* OBSOLETE    
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
OBSOLETE */
//
//      cacheupdate  --  update entries in cache
//
//      Async, but no callback. Done in bulk to avoid unnecessary async events.
//
//      Yes, an extra level of object encapsulation. Backwards compatibility.
//
function cacheupdate(ratingitempairs, ttlsecs)
{   var updateitems = {}
    var now = nowsecs();                                // timestamp
    for (var domain in ratingitempairs) {
        updateitems[domain] = {ttl: now + ttlsecs, ratingreply: ratingitempairs[domain] };
    }
    console.log("Updating cache: " + JSON.stringify(updateitems));    // ***TEMP***
    storageset(RATINGPREFIX, updateitems);              // insert, no callback
}
//
//  cachepurge -- purge all obsolete items
//
//  Every "ttlsecs", all old entries are purged.
//
//  ***NEEDS WORK***
//
function cachepurge(ttlsecs)
{   var now = nowsecs();
    function found(item) {
        if (item === undefined || item === null) return; // no find
        var val = item[key];                            // get value 
        if (item[key] === undefined || item[key] === null) //   no find
        {   storageset(LASTCACHEPURGETIME,"", {purgetime: now });   // set last purge time as now
            console.log("Note: initialized SiteTruth cache."); 
        }
        if (val.purgetime + TTLSECS >  now) return;     // no purge needed
        //  Do purge
        if (prefs.verbose) 
        {   console.log("Note: purged old SiteTruth ratings from cache at time " + nowsecs() + ".");    }
        // ***NEED TO READ ALL ENTRIES AND PURGE OLD ONES***
    } 
    storageget(LASTCACHEPURGETIME,"").then(found, storageerror);
}
/* OBSOLETE   
    if (msimplestorage.storage.lastcachepurgetime + ttlsecs > now)  // no purge
    {   return; }                                                   // no purge
    var prefs = getprefs();                         // get preferences object
    if (prefs.verbose) 
    {   console.log("Note: purged old SiteTruth ratings from cache at time " + nowsecs() + ".");    }
    for (var key in msimplestorage.storage.ratingcache) // for all keys
    {    cachesearch(key);   }                      // this will delete obsolete values
    msimplestorage.storage.lastcachepurgetime = now;// time of last purge is now
} OBSOLETE */
//
//  Cache overflow handling.  This is unlikely, but should be handled.
//
////msimplestorage.on("OverQuota", function () 
////    {   msimplestorage.storage.ratingcache = {}     // clear cache
////        console.error("SearchRater cache overflowed.  Cache cleared.");
////    }
////);
//
//    Use of cache for SiteTruth rating
//
function updatedomaincache(cacheinserts)
{    cacheupdate(cacheinserts, KCACHETTL);    }    // update cache
//
//    checkdomaincache  --  check in cache.
//
//    Returns {rating: rating, ratingreply: ratingreply} or null.
//
function searchdomaincache(domain)
{    
    return(cachesearch(domain));                    // return rating, ratingreply
}
