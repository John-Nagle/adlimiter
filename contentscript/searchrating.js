//
//    Rate all Google search results using SiteTruth rating system.
//    J. Nagle        SiteTruth
//    April, 2011
//
//  TODO:
//      1.  Find way to reliably get enclosing element of ad.
//      2.  Extract domain from CITE text, compare with link URL.
//      3.  Reorder ads based on rating.
//
//
//    Configuration
//
"use strict";                                       // strict mode
var stkey = "searchrater";                          // key for SiteTruth site access
var kmaxatags = 1000;                               // after this many links, stop.  Slows page loads
var kcheckedattr = "searchrater_checked";           // attribute used to ID changes made
var kinsertedattr = "searchrater_inserted";         // attribute used to ID changes made
var kisadattr = "searchrater_isad";                 // this is an advertising link
//
var kratinginprogressmsg = "Rating in progress...";
//
var gballoonmgr = null;                             // balloon manager, if enabled
var gmutationobserver = null;                       // mutation observer, if enabled
//
//  addGlobalStyle  --  GreaseMonkey recommended approach
//
//  Modified to avoid using innerHTML
//
function addGlobalStyle(doc, css) {
    var head = doc.getElementsByTagName('head')[0];         // find head element, which should exist
    if (!head) { return; }                                  // defective HTML document
    var style = doc.createElement('style');                 // create <style> element
    style.type = 'text/css';   
    if (style.styleSheet)                                   // for some cross-browser problem
    {   style.styleSheet.cssText = css;                     // attach CSS text to style elt
    } else {
        style.appendChild(document.createTextNode(css));    // attach CSS text to style elt
    }
    head.appendChild(style);                                // attach style element to head
}

//
//    insertAround  --  encloses elt with a new elt
//
function insertAround(elt, newelt) 
{
    var parent = elt.parentNode;                            // get parent
    if (parent === null)                                    // Tag is orphaned
    {   if (prefs.verbose) 
        {   console.log("Orphaned DOM item - unable to insert " + node_to_string(newelt) + " around " + node_to_string(elt) + " - no parent."); }
        return; 
    }
    parent.replaceChild(newelt, elt);                       // new replaces old
    newelt.appendChild(elt);                                // old becomes child
}

//    LOCAL FUNCTIONS

//
//  containsblockelt -- returns true if elt contains any block-type elt.
//
//  We're looking for a block element, one we can use to locate our 
//  rating icon.  The desired element has to be a "block" element,
//  and it can't have absolute positioning or a different Z index
//  than the starting element. 
//
//  It ought to be sufficient to check the computed style of the elt,
//  but it's possible to have an A tag with display of "inline" 
//  enclosing a DIV.  So we have to look not only at the tag, but at
//  all the tags below it.
//
//  This makes getblockelt O(N^2), which is not good.  But for Google ads, so far
//  N is very small.  There's a recursion depth limit, because, for some
//  situations (Google News pages), we seem to have an infinite recursion depth.
//  This is somehow related to a problem with the "XRayWrapper" mechanism used
//  in the Mozilla sandbox.
//
//  There ought to be an easier way to do this.
//
//
function containsblockelt(elt, depth)
{   if (elt === null) return(false);                    // nulls have no properties
    var kcontainmax = 10;                               // recursion runaway check
    if (depth > kcontainmax)                            // are we hung in a recursion?
    {   if (prefs.verbosepref) 
        {   console.log("Containsblockelt error: items nested too deep at " + elt); }
        return(false);                                  // fail
    }
    ////console.log("containsblockelt: " + elt);                 // ***TEMP***
    if (elt.nodeType != 1) { return(false); }           // must be ELEMENT_NODE
    var eltname = elt.nodeName.toUpperCase();           // "DIV", etc.
    var ariahaspopup = elt.getAttribute("aria-haspopup");   // get has-popup indicator
    var computedstyle = document.defaultView.getComputedStyle(elt, null);    // get style
    var visibility = computedstyle.getPropertyValue("visibility");    // get visibilty
    var zindex = computedstyle.getPropertyValue("z-index");
    var position = computedstyle.getPropertyValue("position");
    var displaystyle = computedstyle.getPropertyValue("display");    // get display attr
    //   Try to determine if this is a popup or hidden, not something that appears inline.
    if (ariahaspopup == "true" || visibility == "hidden")  // not block element if invisible
    {   return(false);  }
    if (displaystyle != "inline" && displaystyle != "inline-block" && position != "absolute")  // if valid block elt
    {   ////****Should check z index****
        ////console.log(displaystyle + " " + eltname + ": " + elt); // ***TEMP***
        return(true);                                       // Found good item.
    }
    if (displaystyle == "inline-block")                     // inline even if children are blocks
    {   return(false);  }
    //  Check subtree below element.  
    if (elt.childNodes === null) { return(false); }         // no children
    for (var i=0; i < elt.childNodes.length; i++)           // for all children
    {    if (containsblockelt(elt.childNodes[i], depth+1)) { return(true); }    // recurse down tree
    }
    return(false);                                        // found no block elt
}
//
//  getblockelt --  move outward to first block-type elt surrounding an inline elt
//
function getblockelt(elt)
{   while (true)
    {   if (elt === null) { return(null); }             // fails
        if (containsblockelt(elt,0)) { break; }         // quit when a block elt found.
        ////console.log("getblockelt - looking outward at " + elt);// ***TEMP***
        elt = elt.parentNode;                           // move out one level
    }
    return(elt);                                        // return found elt
}
//
//  labeladlinks  --  label array of ad links for same domain with SiteTruth markings
//
//  This is a callback from the rating operation that queries the server.
//  These callbacks come in over time, as the rating server returns results.
//
function labeladlinks(rlinks, domain, rating, ratingreply)
{   if (rlinks === null) { return; }                                // ignore if null
    for (var i = 0; i < rlinks.length; i++)                         // for entire array
    {   var rlink = rlinks[i];                                      // rating link of interest
        rlink.setrating(rating, ratingreply, calcratingsortkey(rating)); // set rating in RatingLink   
        labeladlink(rlink, domain, rating, ratingreply);             // label ad links with real rating
    }
}
//
//    isstratingelt  --  true if this is an element we inserted
//
function isstratingelt(elt)
{   if (elt === null) { return(false); }                            // no elt, no
    if (elt.nodeName.toLowerCase() != "div") { return(false); }     // not span, no
    if (elt.getAttribute("class") === null)  { return(false); }     // no class, no
    if (!elt.getAttribute("class").match(/^strating/))  { return(false); }    // not ours, no
    return(true);                               // this is one of our inserted elts
}
//
//  formatnumber  -- format a number in a concise format
//
function formatnumber(n) 
{   //  Just NNN,NNN,NNN for now
    if (n < 0) return("-" + formatnumber(-n));  
    var a = n % 1000;                                   // low part
    var b = Math.floor(n / 1000);                       // high part
    if (b == 0) return(a.toString());
    return(formatnumber(b) + "," + (a+1000).toString().substr(1));  // horrible hack for lead zeroes
    ////return(formatnumber(b) + "," + (a).toString());     // horrible hack for lead zeroes
}
//
//  formatrange  -- format a range of numbers
//
function formatrange(lo, hi) 
{
    if (lo && hi)                                               // lo and hi both present
    {   if (lo == hi) { return(formatnumber(lo)); }             // one number    
        return(formatnumber(lo) + " to " + formatnumber(hi));   // two number range
    }
    if (lo)                                                     // lower bound only
    {   return("over " + formatnumber(lo)); }
    if (hi)                                                     // upper bound only
    {   return("under " + formatnumber(hi)); }
    return("???");                                      // not supposed to get here
}
//
//    updateadlabel --  update our label on an ad
//
//    Updates icon and links.  Structure has already been constructed
//
function updateadlabel(elt, domain, rating, ratingreply)
{
    if (rating == "X")                                  // if bad
    {   elt.setAttribute("class","stratingbad");   }    // class for enclosing DIV

    var cssclass = "strating" + rating.toLowerCase();   // construct CSS class name
    var imgprefix = stimagebase;                        // use base URL for image location
    if (datadir) imgprefix = datadir;                   // if we have a data directory, use it
    var imglink = imgprefix + stratingiconlinks[rating];// get appropriate rating icon
    var alttext = stratingalttext[rating];              // get alt text
    if (imglink === null)                               // if no link
    {   imglink = imgprefix + stratingiconlinks["U"];   // errors yield U, the grey circle
        alttext = "ERROR - no rating";
    }
    var detailslink = stdetailslink1 +  encodeURIComponent(domain) + stdetailslink2;    // build link URL
    var divs = elt.getElementsByTagName("div");         // use backup algorithm to work around bug
    for (var i=0; i < divs.length; i++)
    {   var layerdiv = divs[i];
        if (layerdiv.className == "sticonlayer")        // if our DIV
        {   var aelt = layerdiv.firstChild;             // get A elt below it
            var imgelt = aelt.firstChild;               // get IMG elt below that
            if (imgelt.tagName != "IMG")
            {   console.error("ERROR - failed to find IMG item for icon update.  Found " + imgelt.tagName); return; }
            imgelt.src = imglink;                       // set image link
            imgelt.alt = alttext;                       // set alt text
            updateballoon(imgelt, detailslink, domain, rating, ratingreply);    // update balloon
            if (prefs.verbosepref)
            {   console.log("Updated rating icon for " + domain + " to " + imglink); }
            return;                                      // done
        }
    }
    //  Extensive debugging info if a rating icon can't be updated.
    console.error("ERROR - failed to find rating icon below " + elt.tagName + " for " + domain + " to change to " + imglink);    // failed to find item to update
    console.log("  DIV count: " + divs.length);              // count of DIVs, which seems to be zero sometimes.
    for (var i=0; i < divs.length; i++) console.log("  DIV class: " + divs[i].className);    
    dom_dump(elt, "Rating icon not found in this DOM subtree:");
}
//
//    labeladlink  --  label one ad link with SiteTruth markings
//
function labeladlink(ritem, domain, rating, ratingreply)
{   
    if (prefs.verbosepref)                                        // debug
    {   console.log("Label ad link " + node_to_string(ritem.elt) + " for " + domain);
    }
    if (!ritem.rateable) return;                        // ignore if not a rateable item
    if (ritem.linkpurpose == "AD")                      // if this is an ad
    {   ritem.elt.setAttribute(kisadattr, "t") == "t" } // mark link in DOM as marked ad
    var newdiv = null;                                  // new DIV generated to enclose rating
    var enclosingelt = ritem.boxelt;                    // label the box element
    if (enclosingelt === null)                          // no enclosing elt, unexpected
    {   if (prefs.verbosepref)
        {   console.log("No enclosing element for ad domain " + domain);  }  // happens for inline items
        return(null);
    }
    if (prefs.verbosepref)
    {    console.log("Enclosing elt: " + node_to_string(enclosingelt) + " for " + domain);    
    }
    var cssclass = "strating" + rating.toLowerCase();   // construct CSS class name
    //    We have found the next outer enclosing block elt.
    //    Create a DIV under it which contains all its existing children,
    //    unless we have already done that.
    //    Either the enclosing elt or its first child will be our elt if already
    //    created.
    if (isstratingelt(enclosingelt))                    // if already have our elt
    {   updateadlabel(enclosingelt, domain, rating, ratingreply); }    // change class of our tag
    else if (isstratingelt(enclosingelt.firstChild))    // if first child is ours
    {   updateadlabel(enclosingelt.firstChild, domain, rating, ratingreply); }    // change tag
    else if (isstratingelt(enclosingelt.parentNode))
    {   updateadlabel(enclosingelt.parentNode, domain, rating, ratingreply); }    // change tag
    else                                                // must create it
    {   var newdiv = enclosingelt.ownerDocument.createElement("div");// create enclosing DIV
        var enclosingclass = "strating";
        newdiv.setAttribute("class",enclosingclass);        // class for enclosing DIV
        //    We now have a DIV tag to put around the advertisment.  
        //    SiteTruth information can be attached to that DIV.
        //    We create the structure
        //        DIV    class="strating"
        //            DIV    class="sticonlayer"
        //                A    link to details page (now SPAN, for mobile compat.)
        //                    IMG    rating icon
        //    Then updateadlabel plugs in the link, alt text, and rating icon links.
        //
        if (prefs.verbosepref)
        {   console.log("Inserting DIV element for  " + domain); }
        var layerdiv = newdiv.ownerDocument.createElement("div");
        layerdiv.setAttribute("class","sticonlayer");       // set class
        var aelt = newdiv.ownerDocument.createElement("span"); // filled in by updatelabel
        aelt.setAttribute(kinsertedattr, "t");              // avoid rating our own rating
        //aelt.target = "_blank";                             // open in new document
        var imgelt = newdiv.ownerDocument.createElement("img");// filled in by updatelabel
        imgelt.align = "right";                             // image at right
        imgelt.border = "0";                                // no image border
        newdiv.appendChild(layerdiv);                       // build structure
        layerdiv.appendChild(aelt);
        aelt.appendChild(imgelt);
        //  If the enclosing tag is an A tag in block mode, we wrap our DIV
        //  tag around the A tag.
        var putaround = (enclosingelt.nodeName.toLowerCase() == 'a');    // if A tag
        if (putaround) 
        {   insertAround(enclosingelt, newdiv);    }        // insert DIV around A
        else                                                // otherwise
        {   var children = enclosingelt.childNodes;         // get the array of children
            ////console.log("Element before mod child count: " + enclosingelt.childNodes.length);
            var ourchildren = new Array();                  // copy of nodes during alteration
            var i;
            for (i=0; i < children.length; i++)             // copy list
            {    ourchildren.push(children[i]);    }        // that we will be changing
            enclosingelt.appendChild(newdiv);               // add DIV below elt. (Trying this before adding children)
            for (i=0; i < ourchildren.length; i++)          // for ell existing nodes
            {    newdiv.appendChild(ourchildren[i]);        // move children under our DIV
                 if (prefs.verbosepref) {console.log("Put " + ourchildren[i].nodeName + " under new elt"); }   
            }
            ///enclosingelt.appendChild(newdiv);               // add DIV below elt.
        }
        updateadlabel(newdiv, domain, rating, ratingreply);  // add rating info
        ////console.log("Element after mod child count: " + elt.childNodes.length);    // ***TEMP***
    }
}
//
//      doadlinktarget  --  have link elt, have found target url
//
//      Input is a percent-encoded URL.
//
function doadlinktarget(elt, encodedtargeturl)
{
    try 
    {
        var targeturl = decodeURIComponent(encodedtargeturl);       // decode "%" escapes
        var parsedurl = new Poly9.URLParser(targeturl);             // break apart URL
        var domain = parsedurl.getHost().toLowerCase();             // get the domain
        var basedom = basedomain(domain);                           // get base domain
        if (basedom === null) { return(null);   }                   // handle non-domain
        //  Check for special case domains.  Ignore all special domains in ad links.
        //  ***NOT GOOD SOLUTION*** - the special case link may indicate an ad domain,
        //  but just contain a useless tracking link. We need to associate the 
        //  info that this is an ad with the related Resultlink item.
        ////if (specialdomains[domain]) { return(null); }
        ////if (specialdomains[basedom]) { return(null); }               // do not rate or box
        var result = new Resultlink(elt, domain, "SEARCH", true);   // assume search result
        if (prefs.verbosepref)
        {    result.dump(); }
        return(result);                                             // return domain to rate
    } catch(e) {
        console.log("Unparseable ad URL (" + e + "): " + targeturl);    // long wierd URLs
    }
    return(null);                                                // failed, nothing to rate
}
//
//  dononspeciallink  --  do a non-special link
//
//  For non-ad links.
//
function dononspeciallink(elt, domain, url, urlquery)
{   
    if (prefs.searchpref < 0) return(null);                         // configured off
    var hreply = doadlinktarget(elt, domain);                       // pass to domain handler
    if (hreply)                                                     // if successful
    {   elt.removeAttribute("onmousedown");  }                      // remove unnecessary pass through Google
    return(hreply);
}

//
//  dolinkurl --  handle a url found in an element
//
//  Returns a Resultitem or null
//
function dolinkurl(elt, url)
{
    try {
        if (prefs.verbosepref) 
        {   console.log("Node: " + node_to_string(elt) + "  URL: " + url.toString());  }   
        if ((url === undefined) || (url === null) || (url.length < 1) || 
            (url[0] == "/") || (url[0] == '#'))                     // if not a good URL
        {    return(null);    }                                     // can't be ad
        var parsedurl = new Poly9.URLParser(url);
        var domain = parsedurl.getHost().toLowerCase();             // get the domain
        var basedom = basedomain(domain);                           // get base domain
        var parts = parsedurl.getPathname().split('.');             // parts of pathname
        if (parts.length > 1)                                       // do not try to rate links to pure images.  
        {   var extension = parts[parts.length-1].toLowerCase();    // file extension (last part after last .
            if (extension == "jpg" || extension == "jpeg" || extension == "png" || extension == "gif") return(null);
        }
        if (basedom === null) { return(null);   }                   // handle non-domain
        if (prefs.verbosepref) 
        {   console.log("Node: " + node_to_string(elt) + "  Domain: " + domain + "  Base domain: " + basedom); }   // log the href
        //    Look for an ad URL of a known type
        var handler = getspecialdomainhandler(domain);              // get handler for domain
        if (handler)                                                // if handler for this domain
        {   ////console.log("Calling ad handler");                       // ***TEMP***
            //    Call appropriate handler for this domain
            var rateitem = handler(elt, domain, url, parsedurl.getQuerystring());    
            if (rateitem) { return(rateitem); }                     // success
            ////console.log("Unrecognized " + basedom + " URL: " + url);    // log rejected URLs       
        } else {                                                // non-special domain, just rate
            var rateitem = dononspeciallink(elt, domain, url, parsedurl.getQuerystring());  
            if (rateitem) { return(rateitem); }                        // success
            ////console.log("Unrecognized " + basedom + " URL: " + url);    // log rejected URLs
        }
    } catch(e) {
        console.log("Unparseable URL (" + e + "): " + url);            // long wierd URLs
    }
    return(null);                                                // nothing to rate
}
//
//  dolink --  handle a link (A) element
//
//  Returns a Resultitem or null
//
function dolink(elt)
{
    if (elt.href === null || elt.href === undefined)                // avoid undefs
    {    return(null);    }
    try {
        var url = decodeURI(elt.href);                              // unescape ***IS THIS DOING ANYTHING***
    } catch(e) {
        console.log("Unparseable link URL (" + e + "): " + url);         // long wierd URLs
        return(null);                                               // ignore
    }
    return (dolinkurl(elt, url));                                   // do link target
}
//
//    geturlbase  --  get base url of document
//
function geturlbase(doc)
{   var urlbase = null;                                             // no URL base yet
    var allbasetags = doc.getElementsByTagName("base");             // get BASE elt
    if (allbasetags.length > 0)                                     // if have BASE tag
    {    urlbase = allbasetags[0].getAttribute("href");             // get HREF param
    }
    if (urlbase === null)                                           // if no BASE tag
    {    var parsedurl = new Poly9.URLParser(doc.URL);              // break apart URL
         urlbase = parsedurl.getProtocol() + "://" +                 // build up base URL
            parsedurl.getHost() + parsedurl.getPathname();                            
    }
    return(urlbase)
}
//
//    findresultitems  --  analyze the document, finding items of interest
//
//  The boxes around items of interest are found and returned.
//
function findresultitems(doc)
{   var resultitems = new Resultlinkpage();                     // all resultitems on page.
    if (doc === null) { return(null); }                         // avoid empty
    if (doc.nodeName != "#document")                            // must be a document
    {   console.log("IFRAME was not parent of document, but of " + doc.nodeName);
        return(null);                                           // does nothing
    }
    ////console.log("Starting subdocument");        // ***TEMP***
    var adcount = 0;                                            // ads seen so far
    //  Find all A tags with a link.
    var allatags = doc.getElementsByTagName("a");               // get links
    //  Examine all links; find which ones need rating.
    //  Builds an associative array indexed by domain of arrays of DOM elements.
    var found = false;                                          // found anything?
    for (var i = 0; i < allatags.length; i++)                   // for all A tags
    {   if (i >= kmaxatags) { break; }                          // stop on huge link lists
        var elt = allatags[i];                                  // A tag to check
        if (elt.getAttribute(kisadattr) == "t")                 // this is an advertisement
        {   adcount++; }                                        // tally ads already marked                            
        if (elt.getAttribute(kcheckedattr) == "t")              // if already done
        {    continue;    }                                     // skip this one
        if (elt.getAttribute(kinsertedattr) == "t")             // if one of ours
        {    continue;    }                                     // skip this one
        elt.setAttribute(kcheckedattr, "t");                    // note as done
        var resultitem = dolink(elt);                           // handle A tag
        if (resultitem !== null)                                // if something to rate
        {   resultitems.push(resultitem);   }                   // add to to-do list
    }
    //  Result items accumulated.  Now condense out redundant ones.
    resultitems.adcount = adcount;                              // save ad count with result items.
    resultitems.buildblocks();                                  // where all the work gets done
    if (prefs.verbosepref) dumpresultlinks(resultitems.mergedresultlinks, "Merged items with boxelts set");
    if (prefs.outlinepref) resultitems.displayboxoutline();     // display the box outlines
    return(resultitems)                                         // resultitems has the block structure
}
//
//  findrateitems --  find rate items, given result items
//
function findrateitems(resultitems)
{   if (rateitems === null) return(null);                       // null
    //  Now work on condensed items
    var rateitems = {};                                         // mark these items for rating
    for (var i=0; i < resultitems.mergedresultlinks.length; i++)// for all items
    {   var rlink = resultitems.mergedresultlinks[i];           // item of interest
        if (rlink.domdeleted) continue;                         // skip if deleted
        if (!rlink.rateable) continue;                          // skip non-rateable item
        if (rlink.rating !== null) continue;                    // skip if already rated
        if (!rlink.domdeleted && rlink.boxelt !== null)         // if usable entry
        {   if (!(rlink.domain in rateitems))                   // if domain not listed
            {    rateitems[rlink.domain] = new Array(); }       // give it an array of elts
            ////console.log("Rating needed: " + resultitem.domain);  // ***TEMP***
            rateitems[rlink.domain].push(rlink);                // add to to-do list
        }
    }
    return(rateitems)                                           // get items to rate
}
//
//    startratings  --  start the rating process after page load and on changes
//
function startratings(doc)
{   var urlbase = geturlbase(doc);                              // get base URL
    if (prefs.verbosepref) { console.log("Starting " + urlbase);    }          // debug
    var contenttype = doc.contentType;                          // get document content type
    if (contenttype)                                            // only Mozilla has this
    {   if (!contenttype.match(/html/)) { return; }             // must be HTML or XHTML
    } else {                                                    // other browsers
        var htmlelts = doc.getElementsByTagName("html");        // look for an HTML element
        if (!htmlelts || htmlelts.length < 1) { return; }       // if not found, this is probably not HTML
    }
    if (checkurlchange()) { return; }                           // Mozilla bug workaround
    updateonchange()                                            // note later updates
    ////console.log("Start search for ads");                         // ***TEMP***
    var resultitems = findresultitems(doc);                     // scan all docs for items
    if (resultitems === null) return;                           // nothing to do
    var rateitems = findrateitems(resultitems);                 // find items to rate
    if (rateitems === null) return;                             // nothing to do
    loadcss(doc);                                               // doc needs our CSS
    //  Query cache, for which we need a callback.  Callback is immediate after
    //  a message pass and reply.
    if (prefs.verbosepref) 
    {   console.log("Querying cache for " + Object.keys(rateitems)); }
    querySiteTruthCache(rateitems, function(reply) { usecacheratings(resultitems, reply); });
}
//
//  usecachedratings --  use cache results from startratings.
//
//  This is the callback from above.
//
//  Ad suppression based on cached ratings is done here.
//  Ad suppression is based on cached ratings only, to avoid having the page
//  change while the user is looking at it.
//
function usecacheratings(resultitems, reply)
{   if (resultitems === null) return;                           // nothing to do
    if (prefs.verbosepref) console.log("Cache reply: " + JSON.stringify(reply));
    //  Label all result items with ratings where available.
    for (var i = 0; i < resultitems.mergedresultlinks.length; i++) // for 
    {   var rlink = resultitems.mergedresultlinks[i];           // Resultlink
        rlink.sortkey = calcratingsortkey("W");                 // use default sort key if no result
        if (rlink.domain in reply)                              // if found in cache
        {   var ditem = reply[rlink.domain];                    // rating info for the domain
            if (ditem)
            {   rlink.setrating(ditem.rating, ditem.ratingreply, calcratingsortkey(ditem.rating));  }   // set rating and sort key
        }
    }
    //  Ad deletion -  delete ads per policy.
    if (prefs.adpref >= 0)                                      // if limiting number of ads
    {                                                           // skip this many ads, then delete
        resultitems.domdelete("AD", Math.max(0, prefs.adpref - resultitems.adcount));
    }
    //  Fill in ratings on anything not yet deleted.  This updates the DOM.
    for (var i = 0; i < resultitems.mergedresultlinks.length; i++) // for 
    {   var rlink = resultitems.mergedresultlinks[i];           // Resultlink
        if (rlink.rating)                                       // if have a rating from cache
        {   labeladlink(rlink, rlink.domain, rlink.rating, rlink.ratingreply); }    // label with rating from cache
        else                                                    // if no rating yet
        {   labeladlink(rlink, rlink.domain, "W", "Rating..."); }   // mark as in progress
    }
    //  Start rating anything we didn't find in cache.
    var rateitems = findrateitems(resultitems);                 // find any domains left we have to rate
    //  Start actual rating cycle, querying server
    querySiteTruthServer(rateitems, labeladlinks, {key: stkey});    // start query 
    if (prefs.verbosepref) { console.log("Ending document"); }        
}
//
// calcratingsortkey -- policy on which ads appear first
//
function calcratingsortkey(rating)
{   if (rating == "A") return(1);                               // good -> sorts first
    if (rating == "X") return(3);                               // bad -> sorts  last
    return(2);                                                  // all else - sorts in middle
}


//
//    nodechanged  -- note that node was inserted or changed
//
//    When a whole subtree is being built, we only get some of the events.
//    All we can really do here is notice when a document has been updated
//    and schedule it for reprocessing
//
var changetimeout = null;                                   // current change timeout if any
var kchangetimeoutsecs = 2;                                 // run 2 secs after idle
function nodechanged(eventObject)
{   if (prefs.verbosepref)
    {   console.log("Node changed - mutation event.");    }
    if (checkurlchange()) { return; }                       // Mozilla bug workaround
    if (changetimeout)
    {   if (prefs.verbosepref) 
        {   console.log("Cancelling old timeout: " + changetimeout); }
        clearTimeout(changetimeout);                        // clear old timeout
    }
    //    Schedule a retry 
    changetimeout = window.setTimeout(
        function() {     startratings(document) },
        kchangetimeoutsecs*1000);
    if (prefs.verbosepref) 
    {   console.log("Setting new change timeout: " + changetimeout); }
}
//
//    attrmodified --  an attribute has been modified.
//
//    If this is an A node and the href has changed, we need to
//    do something about it.
//
//    This is called far too often.  
//    In fact, it really isn't necessary, because, while Google does change
//    ad link URLs, they still point to the same advertiser.  So this should
//    check that the ad target is the same.  Or at least just reprocess the ad,
//    not the whole document.
//
function attrmodified(eventObject)
{
    var elt = eventObject.target;                       // the element
    var attrName = eventObject.attrName;                // name of attr changed
    var newValue = eventObject.newValue;                // new value of attr
    if (elt === null) { return; }                       // no elt
    if (attrName == kcheckedattr) { return; }           // don't act on our own changes
    if (elt.nodeName != "A") { return; }                // not A tag, skip
    if (elt.getAttribute(kinsertedattr) == "t") { return; }    // one of our own 
    if (checkurlchange()) { return; }                   // Mozilla bug workaround
    if (prefs.verbosepref)                                        // see what changed
    {   var relatedNode = eventObject.relatedNode;      // related node
        var prevValue = eventObject.prevValue;
        console.log("Change " + node_to_string(elt) + " " + attrName + '="' + newValue + '" (was "' + prevValue + '")');
    }
    if (attrName != "href") { return; }                 // not HREF change, skip
    ////if (dolinkurl(elt, newValue) !== null)          // if an ad link
    {   if (prefs.verbosepref)
        {    console.log("Ad link changed to: " + eventObject.newValue);
        }
        elt.setAttribute(kcheckedattr, "f");            // note as not done
        nodechanged(eventObject);                       // schedule reprocessing
    }
}
//
//  updateonchange  --  notice page changed itself, handle that.
//
//  Uses mutation observers only now.
//
function updateonchange()
{
    //  Set up mutation observer
    //  Try to use mutation observers.  If not available, report failure.
    //  Use standard mutation observers, not mutation summaries, for portability.
    if (gmutationobserver) return;                          // already have a mutation observer
    try                                                     // try block will fail on older browsers
    {   var observer = new MutationObserver(nodechanged);   // create mutation observer
        observer.observe(document,                          // attach it to document
            {   subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ["href"]                   // only HREF attributes are important
            });
        gmutationobserver = observer;                       // success, use observer
    } catch(e)                                             // unable to use mutation observer
    {   //  No mutation observers, will not run.
        alert("Add-on too new for this browser.(Mutation observers not supported.)\nPlease update your browser.")
    }
}

//
//    Add global CSS definitions used to express ratings
//
//    sticonlayer -- the clickable icon with our rating goes in a higher layer.
var sticonlayer = ".sticonlayer { \
    position: absolute; \
    opacity: .75; \
    width: 24pt; \
    height: 24pt; \
    right: 0px; \
    top: 0px; \
    z-index: 201; \
}";
var strating = ".strating { \
    position: relative; \
}";
var stratingbad = ".stratingbad { \
    position: relative; \
    opacity: .7; \
}";
var stratingdebug = ".strating { \
    border-style: dotted; \
    border-width: 1px; \
    position: relative; \
}";
var stratingbaddebug = ".stratingbad { \
    position: relative; \
    border-style: dotted; \
    border-width: 1px; \
    opacity: .7; \
}";

//    display: none; // maybe later, after we get the whole item into one block element.
//    zoom: 75%;  // Unimplemented in Firefox - see Bug# 390936
//
//    loadcss -- Load in CSS definitions
//
var cssloaded = false;
function loadcss(doc) 
{   if (cssloaded) return;                              // only do this once per document
    cssloaded = true;                                   // note loaded
    addGlobalStyle(doc, sticonlayer); 
    if (prefs.verbosepref)
    {   
        addGlobalStyle(doc, stratingdebug);             // versions with debug markup
        addGlobalStyle(doc, stratingbaddebug);           

    } else {
        addGlobalStyle(doc, strating);                  // regular versions
        addGlobalStyle(doc, stratingbad); 
    }
    //  Balloon support
    if (kballoonenable) 
    {   gballoonmgr = new BalloonMgr(kballoonarrows, kinsertedattr);   // enable balloon processing
    }
}

