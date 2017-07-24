//
//	sitetruthconfig.js  --  constants for SiteTruth add-on.
//
//  Browser-independent.
//
//	Must load first.
//
//	John Nagle
//	SiteTruth
//	October, 2011
//
//      Configuration
//
"use strict";                                       // strict mode
//
//  SiteTruth site information
const stsite = "http://www.sitetruth.com";          // base URL of SiteTruth site
const stfcgibase = stsite + "/fcgi/";               // location of FCGI programs
const strateprefix = stfcgibase + "rateapiv3.fcgi";    // API URL for queries
const stimagebase = browser.extension.getURL("/images/"); // base for image URLs for images which are part of add-on
const stdetailslink1 = stsite + "/rating/"          // begin details link
const stdetailslink2 = "?format=popup"              // end details link
//
//  General configuration
//
const KCACHETTLSECS = 60*60*24*7;                   // Lifetime of cache entries, seconds
const KADDONNAME = "Ad Limiter";                    // name of the add-on for display
const KRETRYSECS = 5;                               // server retry every 5 seconds
const QUERYTIMEOUTSECS = 10;                        // time our server request after 10 seconds
const KMAXRETRIES = 24;                             // stop retries after 2 minutes

const KPREFSKEY = "P";								// local storage name for prefs

const KDEFAULTPREFS = {                             // default preferences
    verbosepref: false,                             // verbose mode (debugging)
    outlinepref: false,                             // dashed blue outlines around items (debugging)
    adpref: 1,                                      // show this many ads
    searchpref: 1                                   // rate search results
    };
    
//
//  URL configuration
//
//  Pages we want to look at.  These are the result pages of the major search engines.
//  Format here is regular expressions.
//
//  Because WebExtensions have a very limited regular expression syntax available before the
//  content script is loaded, this content script will be loaded for entire domains of search
//  engines. Here, we quickly exit for URLs not of interest.
//
const KSEARCHENGINES = [
    /^(https:\/\/|http:\/\/|)(www\.|)google\.com\/search.*/,        // main Google matches
    /^(https:\/\/|http:\/\/|)(www\.|)google\.com\/\#.*/,            // match Google URLs where args are a fragment, not proper args
    /^(https:\/\/|http:\/\/|)(www\.|)google\.com(\/(\?.*|)|)$/,     // match Google URLs where args are proper args
    /^(https:\/\/|http:\/\/|)news\.google\.com\/.*/,
    /^(https:\/\/|http:\/\/|)maps\.google\.com\/.*/,                // now, with maps
     /^(https:\/\/|http:\/\/|)(www\.|)google\...\/search.*/,
    /^(https:\/\/|http:\/\/|)(www\.|)google\...\/\#.*/,             // match Google URLs where args are a fragment, not proper args
    /^(https:\/\/|http:\/\/|)(www\.|)google\...(\/(\?.*|)|)$/,      // match Google URLs where args are proper args
    /^(https:\/\/|http:\/\/|)news\.google\...\/.*/,                 // Google ccTLD matches
    /^(https:\/\/|http:\/\/|)maps\.google\...\/.*/,                 // now, with maps
    /^(https:\/\/|http:\/\/|)(www\.|)bing.com\/search.*/,
    /^(https:\/\/|http:\/\/|)(www\.|)bing.com\/maps.*/,             // Bing maps, too
    /^(https:\/\/|http:\/\/|)search.yahoo.com\/.*/,
    /^(https:\/\/|http:\/\/|)(www\.|)(education.|)iseek.com\/iseek\/.*/,
    /^(https:\/\/|http:\/\/|)(www\.|)yandex.com\/yandsearch.*/,      // Yandex
    /^(https:\/\/|http:\/\/|)(www\.|)duckduckgo\.com\/\?q\=.*/
    ];
    

//
//  Rating option constants
//
//  Set by configuration, which is platform-dependent  
//
//  Values in options.html must match this
//
const RATEDONOTRATE = 0;                  // do not rate 
const RATESHOW = 1;                       // rate and show ratings
const RATEREORDER = 2;                    // rate and reorder 
const RATEHIDEBAD = 3;                    // hide low-ranking 
const RATEHIDEALL = 4;                    // hide all (ads only)
//
//    Table of rating icon links and alt text.
//
const stratingiconlinks = {
        "A" : "symbolgreen.svg",
        "Q" : "symbolyellow.svg",
        "X" : "symbolred.svg",
        "U" : "symbolclear.svg",
        "W" : "symbolwait.gif",
        "P" : "symbolprivate.gif" }

//
//  Text that needs localization
//        
const stratingalttext = {
        "A" : "Site ownership and business identity verified. No significant issues found.",
        "Q" : "Site ownership identified but not verified.",
        "X" : "Site ownership unknown or questionable.",
        "U" : "No information available.",
        "W" : "Rating...",
        "P" : "Private browsing" }
        
 
 //
 // Info balloons
 //
 const kballoonenable = true;            // balloons on or off
 ////const kballoonarrows = [stimagebase + "balloonarrowdn.png", stimagebase + "balloonarrowup.png"]; // dn/up arrow images
 const kballoonarrows = null;             // turn off arrows - not needed visually


