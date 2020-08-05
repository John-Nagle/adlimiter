//
//  specialdomains.js  --  content script side interface to add on code for Mozilla page mod API
//
//  Special cases for specific domains.
//
//  John Nagle
//  SiteTruth
//  December, 2011
//
"use strict";                                               // strict mode
//
//  Table of handlers for domains that need special handling when found in links.
//
//  For the search sites we process, we have to ignore their in-house links,
//  or the pages become cluttered with useless rating icons.
//
//  Note that any domain listed here ending in ".com" will also match for any 2-char ccTLD.
//
var specialdomains = {
    "maps.google.com": dogooglemaplink,                     // Google map link
    "plus.google.com" : donothinglink,                      // ignore Google social in-house links
    "google.com" : dogooglelink,                            // Google link on Google page
    "googleadservices.com": dogooglesyndicationlink,        // Google ad on Google page
    "clickserve.dartsearch.net" : doadredirectorlink,       // Google ad, unknown advertiser (Google owns Dartsearch)
    "clk.atdmt.com" : doadtrackinglink,                     // Ad tracking service, ignore
    "tracker.marinsm.com" : doadtrackinglink,               // Ad tracking service, ignore
    "xg4ken.com" : doadtrackinglink,                        // Ad tracking service, ignore
    "track.searchignite.com" : doadtrackinglink,            // Ad tracking service, ignore
    "hypertracker.com" : doadtrackinglink,                  // Ad tracking service, ignore
    "tracking.intermundomedia.com" : doadtrackinglink,      // Ad tracking service, ignore
    "pixel.everesttech.net" : doadtrackinglink,             // Ad tracking service, ignore  
    "reachlocal.com" : doadtrackinglink,                    // Ad tracking service, ignore
    "r.search.yahoo.com" : doyahoosearchresultlink,         // Yahoo search result link
    "yahoo.com" : doyahoosyndicationlink,                   // Yahoo ad on Yahoo page, possibly
    "googleusercontent.com" : donothinglink,                // ignore in-house Google link
    "youtube.com" : donothinglink,                          // ignore in-house Google link
    "blogger.com" : donothinglink,                          // ignore in-house Google link
    "bing.com" : dobinglink,                                // in-house links on Bing pages
    "msn.com" : donothinglink,                              // ignore MSN content
    "live.com" : donothinglink,                             // ignore MSN Live content
    "duckduckgo.com" : donothinglink,                       // ignore DuckDuckGo
    "r.msn.com" : domsnsyndicationlink,                     // MSN ad, unknown advertiser
    "advertising.microsoft.com": doadredirectorlink,        // Microsoft ad, unknown advertiser
    "go.microsoft.com" : donothinglink,                     // Microsoft in-house link
    "yandex.com" : donothinglink,                           // Yandex in-house link
};   

//
//
//  getspecialdomainhandler -- get handler for special case domains
//
//  We have a table of domains that receive special handling, because
//  they're ad servers.
//
//  We cut off parts of the domain one at a time until we get a match.
//
//  If the TLD is a 2-letter ccTLD, we replace that with "com" and try again.
//
function getspecialdomainhandler(domain)
{   if (!domain) return(null);                                      // no domain, fail
    var handler = specialdomains[domain];                           // try simple lookup
    if (handler) return(handler);                                   // simple case worked
    //  Try shortening domain, and if it's a ccTLD, try it in "com" instead.
    var domainparts = domain.split(".");                            // split domain into components
    if (domainparts.length >= 2 && domainparts[domainparts.length-1].length == 2) // if ends in two letters
    {   domainparts[domainparts.length-1] = "com"; }                // force TLD to ".com"
    while (domainparts.length >= 2)                                 // trim domain one field at a time
    {   var testdomain = domainparts.join(".");                     // reconstruct domain
        handler = specialdomains[testdomain];                       // get handler for domain
        if (handler) return(handler);                               // success
        domainparts.shift();                                        // fail, remove lead part and retry
    }
    return(null);                                                   // fail, no match
}
//
//      The special cases
//
//
//      dogooglemaplink  --  do a Google link on a Google map page
//
function dogooglemaplink(elt, domain, url, urlquery)
{   //    Look for fields indicating Google map item links.  Use lowercase field names here.
    var targeturl = findqueryfield(urlquery, {"q":0,});         // find target link
    if (targeturl)                                              // if find
    {   var linkitem = dolinkurl(elt, targeturl);               // treat as a basic link
        return(linkitem);
    }
    if (prefs.verbosepref) {  console.log("Expected fields not found in Google map URL: " + url); }
    return(null);                                        // nothing to rate
}
//
//  dogooglelink  -- do a link on a Google page to Google.
//
//  These can be ads, or for mobile browsers, indirect links to the destination site.
//
//  "https://www.google.com/url" with a "q" parameter means a redirect.
//
function dogooglelink(elt, domain, url, urlquery)
{
    if (url.startsWith("https://www.google.com/url")                // if redirect link
    || url.startsWith("http://www.google.com/url")) 
    {   var targeturl = findqueryfield(urlquery, {"q":0,});         // find target link
        if (targeturl)                                              // if find
        {   var linkitem = dolinkurl(elt, targeturl);               // treat as a basic link
            return(linkitem);
        }
    }
    return(dogooglesyndicationlink(elt, domain, url, urlquery)); // not mobile indirect link, handle
}
//
//  dobinglink -- do a link on a Bing page to Bing.
//
//  Typical Bing ad link:
//
//  <a class="b_textAdTitleLink" onclick="" 
//    href="https://www.bing.com/aclk?...
//
//  Detects ads here. But we can't tell to whom the ad refers. That's encrypted.
//
function dobinglink(elt, domain, url, urlquery)
{
    if (url.startsWith("https://www.bing.com/aclk")                // if redirect link
    || url.startsWith("http://www.bing.com/aclk")) 
    {   if (prefs.verbosepref) console.log("Marked as ad: " + targeturl);  // note marked as ad
        return(new Resultlink(elt, domain, "AD", false));           // Ad tracking link, no rating
    }
    return(null);                                                   // nothing to rate
}
//
//      dogooglesyndicationlink  --  do a Google ad link
//
function dogooglesyndicationlink(elt, domain, url, urlquery)
{   //    Look for fields indicating Google ad link targets.  Use lowercase field names here.
    if (prefs.adpref < 0) return(null);                         // configured off
    var targeturl = findqueryfield(urlquery, {"adurl":0, "adu":0 });    // find ad site
    if (targeturl)                                              // if find
    {   var linkitem = dolinkurl(elt, targeturl);               // pass sublink to link handler - recursion
        if ((linkitem != null) && (linkitem.linkpurpose == "SEARCH"))    // if not marked as something else
        {   linkitem.setpurpose("AD");                          // this is an ad
            if (prefs.verbosepref) console.log("Marked as ad: " + targeturl);  // note marked as ad
        }
        return(linkitem);
    }
    //    Check for Google "redir" URL.  Ignore.
    var redirfield = findqueryfield(urlquery, {"redir_url" : 0});    // get redir type URL
    if (redirfield)                                             // if find
    {    return(null);                                          // Google advertising itself
    }
    if (prefs.verbosepref) {  console.log("Expected fields not found in Google ad URL: " + url); }
    return(null);                                        // nothing to rate
}
//
//      domsnsyndicationlink  --  do a MSN ad link
//
function domsnsyndicationlink(elt, domain, url, urlquery)
{   //    Look for fields indicating Google ad link targets.  Use lowercase field names here.
    if (prefs.adpref < 0) return(null);                         // configured off
    var targeturl = findqueryfield(urlquery, {"u":0 });         // find ad site
    if (targeturl)                                              // if find
    {   var linkitem = dolinkurl(elt, targeturl);               // pass sublink to link handler - recursion
        if ((linkitem != null) && (linkitem.linkpurpose == "SEARCH"))    // if not marked as something else
        {   linkitem.setpurpose("AD");                          // this is an ad
            if (prefs.verbosepref) console.log("Marked as ad: " + targeturl);  // note marked as ad
        }
        return(linkitem);
    }
    //    Check for Google "redir" URL.  Ignore.
    var redirfield = findqueryfield(urlquery, {"redir_url" : 0});    // get redir type URL
    if (redirfield)                                             // if find
    {    return(null);                                          // Google advertising itself
    }
    if (prefs.verbosepref) {  console.log("Expected fields not found in Google ad URL: " + url); }
    return(null);                                        // nothing to rate
}
//
//      doyahoosyndicaticationlink  --  do a Yahoo search result or ad link
//
//      Yahoo search result and ad links have the form
//
//      http://search.yahoo.com/r/
//      and end with "/**" followed by another URL
//
var kyahooresultpat1 = /^(https:\/\/|http:\/\/|)search.yahoo.com\/r\/.*/i
var kyahoourlpospat = /\/\*\*/i                                 // recognize "/**"
function doyahoosyndicationlink(elt, domain, url, urlquery)
{
    if (!kyahooresultpat1.test(url))                             // if not a Yahoo result URL
    {   return(null);                                           // can't use it
    }
    var urlix = url.search(kyahoourlpospat);                    // find "/**"
    if (urlix < 0)
    {   console.log("Yahoo search result URL has unexpected format: no  '/**' term: " + url);    // report
        return(null);                                           // fails
    }
    var url2 = url.slice(urlix + 3);                            // get part after match (always shorter)
    url2 = decodeURIComponent(url2);                            // decode nested URL
    ////console.log("Yahoo URL: " + url2);                               // ***TEMP***
    return(dolinkurl(elt, url2));                               // Use internal URL and try again
}
//
//  doyahoosearchresultlink -- a Yahoo.com search result.
//
//  Example link: http://r.search.yahoo.com/_ylt=AwrT6V2.HZJVOTgA3eUnnIlQ;_ylu=X3oDMTE0bzVtbW5mBGNvbG8DZ3ExBHBvcwMxBHZ0aWQDRkZYVUkyMF8xBHNlYwNzcg--/RV=2/RE=1435668031/RO=10/RU=https%3a%2f%2fwww.cars.com%2f/RK=0/RS=UVStfUXtC_SEnrpoupHxJgFUd2Q-
//
//  Look for "/RU=.*/"
//
var kyahooresultpat2 = /\/RU=([^/]+)\//i                            // match "RU=url/"
function doyahoosearchresultlink(elt, domain, url, urlquery)
{
    ////console.log("Yahoo search result: " + url);                     // ***TEMP***
    var matches = url.match(kyahooresultpat2);                      // match pattern
    if (matches && matches.length > 1)
    {   var targetenc = matches[1];                                 // get first match
        var targeturl = decodeURIComponent(targetenc);              // it's in "%" notation.
        ////console.log("Yahoo search target: " + targeturl);           // ***TEMP***
        return(dolinkurl(elt, targeturl));                          // and go around again
    }
    return(null)                                                    // no match
}
//      doadredirectorlink  -- ad-hosting site which redirects, but we can't parse the redirect.
//
//      Such links are treated as ads, but are not rated.
//
function doadredirectorlink(elt, domain, url, urlquery)
{
    if (prefs.adpref < 0) return(null);                         // configured off
    return(new Resultlink(elt, domain, "AD", false));           // redirector site ad
}
//
//      doadtrackinglink --  tracking URL found within ad.
//
//      These mark a block as an ad, but are later discarded.
//
function doadtrackinglink(elt, domain, url, urlquery)
{   if (prefs.adpref < 0) return(null);                         // configured off
    if (prefs.verbose) 
    {   console.log("Ad tracker domain: " + domain); }    
    return(new Resultlink(elt, domain, "AD", false));           // Ad tracking link, no rating
}
//
//      donothinglink  --  ignore links to this domain
//
//      For search results that don't redirect through Google.
//
function donothinglink(elt, domain, url, urlquery)
{   return(null);  }                        // ignore
//
//  Non-special domain links
//
//
//  dononspeciallink  --  do a non-special link
//
//  For non-ad links.
//  Except that, sometimes, what looks like a non-ad link is really a Google ad link.
//
function dononspeciallink(elt, domain, url, urlquery)
{   
    if (prefs.searchpref < 0) return(null);                         // configured off
    var hreply = dononspecialgoogleadlink(elt, domain, url, urlquery);      // check for special Google case
    if (!hreply)                                                    // if not special case                                
    {   hreply = doadlinktarget(elt, domain);   }                   // pass to domain handler
    if (hreply)                                                     // if successful
    {   elt.removeAttribute("onmousedown");  }                      // remove unnecessary pass through Google
    return(hreply);
}

//
//  dononspecialgoogleadlink -- handle A tag where the target domain is in href but it might really be an ad link
//
//  This is required due to light obufusication in Google search result HTML.
//
//  ***ALSO NEED TO HANDLE CASE WHERE href is Google server link but target URL is elsewhere.***
//  ***CHECK FOR PRESENCE OF ONMOUSEDOWN???***
//  ***UNTESTED***
//
function dononspecialgoogleadlink(elt, domain, url, urlquery)
{   if (elt.hasAttributes())
    {   for (var i=0; i<elt.attributes.length; i++)                     // for all attributes
        {   var attr = elt.attributes[i];                           // this attribute
            if (attr.name == "href") { continue; }                  // we already looked at href
            //  Doesn't matter what the attribute name is. 
            //  Matters if it contains a Google ad URL.    
            if (checkgoogleadurl(attr.value))                       // found a Google ad server URL
            {   elt.removeAttribute("onmousedown");                 // remove extra pass through Google
                if (prefs.verbose) 
                {   console.log("Google ad target domain: " + domain); }    
                return(new Resultlink(elt, domain, "AD", true));    // HREF is a rateable ad target
            }
        }
    }
    return(null);                                                   // no find, normal case
}
//
//  checkgoogleadurl -- true if input contains a Google ad URL
//  
//  May be a comma-separated list of URLs. Or something else entirely.
//
//  May find a Google ad URL and a target site URL.
//
//  Returns target URL if target site URL and Google ad URL both.
//  Returns true if Google ad URL only.
//  Returns null if neither - non-ad.
//
function checkgoogleadurl(urls)
{
    var urltab = urls.split(',');
    var targeturl = null;
    var isad = false;                       // not yet known to be a ad
    for (var url in urltab)
    {   url = url.trim();                   // clean
        if ((url.startsWith("http://")) || (url.startsWith("https://")))  // potential Google URL
        {
            if (containsgoogleadurl(url)) { isad = true; } //   Is an ad
            else { targeturl = url; }                   // otherwise ad target           
        }
    }
    if (targeturl == null && isad) { targeturl = true; }    // if ad link but no new target info
    return(targeturl);
}
//
//  containsgoogleadurl -- is this a Google ad server URL?
//
//  Check for dartsearch and Google URLs in specials list
//
function containsgoogleadurl(url)
{
    var parsedurl = parseurl(url);
    if (parsedurl == null) { return(false); }                   // not parseable
    var domain = parsedurl.getHost().toLowerCase();             // get the domain
    var basedom = basedomain(domain);                           // get base domain
    return(specialdomains[basedom] == dogooglesyndicationlink); // true if Google syndication link
}


