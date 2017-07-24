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
function nowsecs() {
    return(Math.floor(Date.now() / 1000));           // return secs since epoch                
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
function storageget(type, keys) {   
    var queries = []                                        // build cache queries
    for (let key of keys) {                                 // for all keys
       if (key === null || key === undefined) continue;     // skip duds
       queries.push(type + key);                            // queries must be prefixed with type
    }
    if (queries.length == 0) return(Promise.resolve({}));   // nothing to ask, return an empty object
    ////console.log("Calling browser.storage.local.get for " + queries);    // ***TEMP***
    return(browser.storage.local.get(queries));             // return promise
}
//  
//  storageerror
// 
function storageerror(error) {
    console.error(`Browse storage error: ${error}`);
}


//
//    Internal format is:
//    
//        { timestamp: time, ratingreply: value }
//
//    cachesearch --  look up entries in cache, get called back on find or no find with array of results.
//
function cachesearch(domains, callback) {
    function found(items) {                             // called by promise
        ////console.log("browser.storage.local.get returned " + JSON.stringify(items)); // ***TEMP***
        var result = {};                                // result is a set of key:value pairs
        var now = nowsecs();                            // time now
        for (var key in items)                          // for all keys in result
        {   var val = items[key];                       // get value 
            if (val === undefined ||                    // check for junk data in cache
                val === null || 
                val.timestamp === undefined ||
                val.timestamp === null ||
                val.ratingreply === undefined ||
                val.ratingreply === null ||             // null in storage
                val.ratingreply.domain === undefined)   // domain must be valid
            {   browser.storage.local.remove(key);      // remove junk entry
                continue;
            }
            var age = now - val.timestamp;              // age of item
            ////console.log("Cache age check for " + key + ": age = " + age);   // ***TEMP***
            if (age > KCACHETTLSECS || age < 0)         // if expired or bogus
            {   browser.storage.local.remove(key);      // get rid of expired item asynchronously
                continue;
            }
            result[val.ratingreply.domain] = {rating: val.ratingreply.rating, ratingreply: val.ratingreply };       // return stored rating reply
        }
        //  Found data
        callback(result);                               // return { domain: ratingreply ... }     
    }
    storageget(RATINGPREFIX, domains).then(found, storageerror);          // query, get promise
}
    
//
//      cacheupdate  --  update entries in cache
//
//      Async, but no callback. Done in bulk to avoid unnecessary async events.
//
//      Yes, an extra level of object encapsulation. Backwards compatibility.
//
function cacheupdate(ratingitempairs) {
    var updateitems = {}
    var now = nowsecs();                                // timestamp
    for (var domain in ratingitempairs) {
        updateitems[domain] = {timestamp: now, ratingreply: ratingitempairs[domain] };
    }
    ////console.log("Updating cache: " + JSON.stringify(updateitems));    // ***TEMP***
    storageset(RATINGPREFIX, updateitems);              // insert, no callback
}
//
//  cachepurge -- purge all obsolete items
//
//  Every "ttlsecs", all old entries are purged.
//
function cachepurge(ttlsecs) {
    var now = nowsecs();
    function fetchedall(items) {
        ////console.log("Get of all local storage: " + JSON.stringify(items));                              // ***TEMP***
        var removelist = [];
        for (var key in items) {
            if (!key.startsWith(RATINGPREFIX)) continue; // ignore storage items which are not ratings.
            var val = items[key];
            if (val === undefined  || val === null ||
                val.timestamp === undefined || val.timestamp === null |
                val.ratingreply === undefined || val.ratingreply === null ||  // null in storage
                val.ratingreply.domain === undefined)   // domain must be valid
            {   removelist.push(key);                   // add to remove list
                continue;
            }
            var age =  now - val.timestamp;             // time to live in seconds
            ////console.log("Cache age check for " + key + ": age = " + age);   // ***TEMP***
            if (age > ttlsecs || age < 0)               // if expired or bogus
            {   removelist.push(key);                   // add to remove list
                continue;
            }
        }
        if (prefs.verbosepref) 
        {   console.log("Note: purged " + removelist.length + " old SiteTruth ratings from cache at time " + now + ".");    }
        var lastpurgetimeitem = {};
        lastpurgetimeitem[LASTCACHEPURGETIME] = now;    // set timestamp of this purge
        browser.storage.local.set(lastpurgetimeitem);   // record last time we did this
        if (removelist.length == 0) return;        
        browser.storage.local.remove(removelist);       // remove everything that timed out.
    }
    function checkpurgeneeded(items) {
        var lastpurgetime = items[LASTCACHEPURGETIME];  // get time of last purge
        ////console.log("Last cache purge was at " + lastpurgetime);    // ***TEMP***
        if (lastpurgetime === undefined || lastpurgetime === null || now - lastpurgetime > ttlsecs)
        {   browser.storage.local.get().then(fetchedall, storageerror);   }        // get everything for the purge
    }
    //  Get last purge time, if any.   
    browser.storage.local.get(LASTCACHEPURGETIME).then(checkpurgeneeded, storageerror);
}
//
//    Use of cache for SiteTruth rating
//
function updatedomaincache(cacheinserts) {
    //  Should check for excessive amount of content in storage, but storage.StorageArea.getBytesInUse() is not yet implemented in Firefox.
    cachepurge(KCACHETTLSECS);                          // purge cache of old items if necessary
    cacheupdate(cacheinserts);                          // add new items     
}
