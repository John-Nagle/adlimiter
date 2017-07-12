//
//      urlutillib.js  -  URL-related libraries for SiteTruth plug-ins
//
//      John Nagle
//      sitetruth.com
//      August, 2011
//      License: GPL
//
//      basedomain  -- get base domain from full domain
//
//      foo.xyz.com => xyz.com
//      foo.co.uk => foo.co.uk
//
//      This should perform the same function as our miscutils.basedomain in Python.
//      However, it's actually a simplified version.  The one in Python on the
//      server has tables of valid TLDs.  
//
"use strict";                                       // strict mode
function basedomain(domain) 
{
    domain = domain.toLowerCase()                   // force lower case
    if (isipaddress(domain)) { return(null); }      // this is an IP address, do not look up
    var parts = domain.split(".")                   // split on "." 
    //    If first part is "www", drop it.
    if (parts.length > 2 && parts[0] == "www")      // if at least three parts
    {    parts.shift();    }                        // remove head item
    if (parts.length > 1)                           // if at least two parts
    {    //    If TLD has two letters, assume country code, take three parts
        var tld = parts[parts.length-1];            // get TLD
        var keepparts = 2;                          // keep two parts
        if (tld.length < 3)                         // if country code TLD
        {    keepparts = 3;    }                    // keep 3 parts (example "foo.co.uk")
        //    Truncate to desired number of parts
        while (parts.length > keepparts)            // if too long, shorten
        {    parts.shift();    }
    } else {                                        // not at least two parts
        return(null);                               // not a valid domain name
    }
    var s = parts.join(".")                         // join parts
    return(s)
}
//
//  isipaddress  -- true if "domain name" is really an IP address.
//
//  If this is true, don't treat it as a domain name.
//
var kpatipv4 = /^(?:[0-9]+\.)+[0-9]+$/              // nnn.nnn...
var kpatipv6 = /^(?:[0-9A-Fa-f]+:)+[0-9A-Fa-f]+$/   // hex:hex:hex...
function isipaddress(domain) 
{
    return (kpatipv4.test(domain) || kpatipv6.test(domain))  // test both
}

//
//    findqueryfield --  find query field in a URL
//
//    Input is a string and an object of desired keywords.  The first find is returned.
//
function findqueryfield(querystring, keys)
{    
    ////console.log("  Query string: " + querystring);                // ***TEMP***
    if (!querystring || querystring === '')                 // if no query string, done
    {    return(null);    }
    var queryitems = querystring.split('&');                // break at '&'
    for (var i=0; i < queryitems.length; i++)               // for all query items
    {   var item = queryitems[i];                           // "name=value" form
        var keyval = item.split('=',2);                     // split into name/value
        if (keyval.length < 2)                              // if no split
        {    continue;    }                                 // skip this field
        var key = keyval[0].toLowerCase();                  // key always LC
        var val = keyval[1];                                // value is either
        ////console.log("  Key: " + key + "  Value: " + val);    // ***TEMP***
        if (key in keys)                                    // if find with any matching key
        {    return(val);    }                              // return value        
    }
    return(null);                                           // no find
}