//  Rates all search results using SiteTruth rating system.
//
//  J. Nagle        
//  SiteTruth
//  October, 2017
//
//  WebExtensions version.
//
//  Imports into the content script
//
"use strict";                                           // strict mode
const TESTITEM = "abc";                                 // ***TEMP***
   
//
//  Configuration
//
//  Pages we want to look at.  These are the result pages of the major search engines.
//  Format here is regular expressions.
//
//  Because WebExtensions have a very limited regular expression syntax available before the
//  content script is loaded, this content script will be loaded for entire domains of search
//  engines. Here, we have to quickly exit for URLs not of interest.
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
console.log("Ad Limiter load start.");  // ***TEMP***

////alert("AdLimiter fired."); // ***TEMP***
////***MORE*** check URL aginst ksearchengines
////mratingquery.enablesiterating(ksearchengines, clientmodules, null); 
startcontentscript();                                               // ***TEMP*** need to test URL against ksearchengines list
