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
"use strict";                                   // strict mode
const stsite = "http://www.sitetruth.com";          // base URL of SiteTruth site
const stfcgibase = stsite + "/fcgi/";               // location of FCGI programs
const strateprefix = stfcgibase + "rateapiv3.fcgi";    // API URL for queries
const stimagebase = stsite +  "/images/";           // base for image URLs
const stdetailslink1 = stsite + "/rating/"          // begin details link
const stdetailslink2 = "?format=popup"              // end details link
const KCACHETTL = 60*60*24*7;                       // Lifetime of cache entries, seconds
const kaddonname = "Ad Limiter";                    // name of the add-on for display
const kretrysecs = 5;                               // server retry every 5 seconds
const kmaxretries = 24;                             // stop retries after 2 minutes

const kdefaultprefs = {                             // default preferences
    verbosepref: false,                             // verbose mode (debugging)
    outlinepref: false,                             // dashed blue outlines around items (debugging)
    adpref: 1,                                      // show this many ads
    searchpref: 1                                   // rate search results
    };

//
//  Rating option constants
//
//  Set by configuration, which is platform-dependent  
//
//  For Jetpack version, values in prefspanel.html must match this
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


