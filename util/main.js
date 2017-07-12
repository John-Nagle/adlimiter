//
//  main.js --  searchrater, a Mozilla add-on main program.
//
//  Rates all search results using SiteTruth rating system.
//
//  J. Nagle        
//  SiteTruth
//  October, 2011
//
//  Imports into the local add-on code side
//
"use strict";                                           // strict mode
const mratingquery = require('ratingquery');            // SiteTruth rating query module

//	Modules to load into the content script side. 
const clientmodules = ["sitetruthconfig.js", "urlutillib.js", "urlparserlib.js", "urlutillib.js", // utilities
    "specialdomains.js", "searchrating.js", "sitetruthclient.js", "resultlink.js",  // rating
    "domdump.js",                                       // debug print
    "balloonmgr.js", "companyballoon.js"];              // balloon support
    
//
//  Configuration
//
//  Pages we want to look at.  These are the result pages of the major search engines.
//  Format here is regular expressions.
//
const ksearchengines = [
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
    
//  Enable site rating
mratingquery.enablesiterating(ksearchengines, clientmodules, null); 
