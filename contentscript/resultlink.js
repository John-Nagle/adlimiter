//
//  resultlink.js  --  resultlink object
//
//  Part of SiteRater / AdRater add-on system
//
//  Sitetruth.com
//  John Nagle
//  December, 2011
//
//  The purpose of all this tree analysis is to identify the block elements in the DOM
//  which contain individual ads and search results.  This is done by looking at the
//  tree structure only.  Javascript class names and IDs are ignored.  This makes
//  the SiteTruth system independent of the detailed output format of various search
//  engines.  This same code is used with five different search engines.
//
//  Once we can put a box around each ad or search result, we then determine which
//  boxes are sequentially adjacent.  These form a group within which we can reorder
//  entries based on our ratings.
//
"use strict";                                       // strict mode
var kstoptags = { "ol" : true, "ul": true, "html" : true, "body": true, "frame": true, 
    "iframe": true, "head" : true, "table" : true, "tbody" : true, "tr" : true, "td" : true};                // never make a box so big it encloses these
//
//  Visible diagnostics of document box structure
//
//  This is for debugging, not general use.
//
//  CSS to outline boxes.  Boxes are drawn with
//  a dashed line around the box, except that boxes
//  which are adjacent to the next box get a dotted line
//  at the bottom.  So a box group outlined by a dashed line
//  consists of boxes which can be reordered for rating purposes.
//
var resultlinkcss = "\
.stboxnoadj {\
	border: medium dashed #0066FF;\
}\
.stboxnextadj {\
	border-top-width: medium;\
	border-right-width: medium;\
	border-bottom-width: thin;\
	border-left-width: medium;\
	border-top-style: dashed;\
	border-right-style: dashed;\
	border-bottom-style: dotted;\
	border-left-style: dashed;\
	border-top-color: #0066FF;\
	border-right-color: #0066FF;\
	border-bottom-color: #0066FF;\
	border-left-color: #0066FF;\
}\
.stboxprevadj {\
	border-top-width: thin;\
	border-right-width: medium;\
	border-bottom-width: medium;\
	border-left-width: medium;\
	border-top-style: dotted;\
	border-right-style: dashed;\
	border-bottom-style: dashed;\
	border-left-style: dashed;\
	border-top-color: #0066FF;\
	border-right-color: #0066FF;\
	border-bottom-color: #0066FF;\
	border-left-color: #0066FF;\
}\
.stboxbothadj {\
	border-top-width: thin;\
	border-right-width: medium;\
	border-bottom-width: thin;\
	border-left-width: medium;\
	border-top-style: dotted;\
	border-right-style: dashed;\
	border-bottom-style: dotted;\
	border-left-style: dashed;\
	border-top-color: #0066FF;\
	border-right-color: #0066FF;\
	border-bottom-color: #0066FF;\
	border-left-color: #0066FF;\
}";
var resultlinkcssloaded = false;                                    // true if this CSS has been loaded

//
//  addclass  -- add class to DOM item
//
function addclass(elt, classstr) 
{   if(elt) 
    {   elt.className += (elt.className ? ' ' : '') + classstr;  }  // insert or add class
}
//
//  isstoptag -- true if stop tag, or some special case
//
function isstoptag(node)
{   if (node === null || node === undefined) return(true);          // treat null as stoptag
    if (node.nodeType != 1) return(false);                          // not an element node, stop
    //  ***TEMP TEST*** this test needs to apply to the outermost tag we keep, not the stop tag, which is up one.  BAD
    ////if (containsblockelt(node,0)) 
    ////{   console.log("Stop tag stopped by block elt: " + node.nodeName)  // ***TEMP***
    ////    return(true); 
    ////}                 // if it's a block elt, must stop
    
    return(node.nodeName.toLowerCase() in kstoptags);               // element, true if in stoptags
}
//
//  isblockdiv  -- true if element is a "div" with a display form of "inline-block"
//
//  These are used to construct horizontal lists of ads.
//
function isblockdiv(node)
{   if (node === null || node === undefined) return(false);         // treat null as stoptag
    if (node.nodeType != 1) return(false);                          // not an element node
    if (node.nodeName.toLowerCase() != "div") return(false);        // not a DIV, false
    var computedstyle = document.defaultView.getComputedStyle(node, null);    // get style
    var displaystyle = computedstyle.getPropertyValue("display");   // get display attr
    if (displaystyle == "inline-block") return(true);               // inline block
    if (displaystyle == "block") return(true);                      // inline block
    return(false);                                                   // block-type DIV
}
//
//  iswhitespace  -- true if element represents white space
//
function iswhitespace(node)
{   if (node === null) return(false);                               // fail
    var nt = node.nodeType;                                         // get node type
    switch (node.nodeType)                                          // fan out on node type
    {   case 1:                                                     // element node
            switch (node.nodeName.toLowerCase())                    // fan out on type
            {   case "li":                                          // if container 
                case "div":                                         // misc empty or code containers are whitespace
                case "span":                                        // look for any content in container
                    for (var i=0; i < node.childNodes.length; i++)  // check children
                    {   if (!iswhitespace(node.childNodes[i])) return(false); } // any non-whitespace fails
                    
                case "script":                                      // scripts are whitespace
                    return(true);
                    
                default:                                            // non-container node
                    return(false);
            }
    
        case 3:                                                     // text node
            return(node.textContent.trim() == "");                  // true if empty text
        
        case 8:                                                     // comment node
            return(true);                                           // always whitespace
            
        default:
            return(false);                                          // all others fail
    }
    return(false);                                                  // unreachable
}
//
//  isnear -- true if values are "near" each other
//
function isnear(a, b, tol)
{   var diff = a - b;  
    if (diff < 0) diff = -diff;                                     // avoid pulling in math package
    return(diff <= tol);                                            // nearness
}
//
//  isvadjacent --  true if elements are vertically adjacent and aligned horizontaly
//
function isvadjacent(elta, eltb)
{   if (elta === null || eltb === null || elta === eltb) return(false); // basic fail conditions
    const tol = 1;                                                  // error tolerance one unit               
    var recta = elta.getBoundingClientRect();                       // bounding box rectangles
    var rectb = eltb.getBoundingClientRect();
    if (prefs.verbosepref) 
    {   console.log("Adjacent box check: "
        + "(" + recta.left + " " + recta.top + " " + recta.right + " " + recta.bottom + ") "
        + "(" + rectb.left + " " + rectb.top + " " + rectb.right + " " + rectb.bottom + ") ");
    }
    var cstylea = document.defaultView.getComputedStyle(elta, null); 
    var cstyleb = document.defaultView.getComputedStyle(eltb, null); 
    var zindexa = cstylea.getPropertyValue("z-index");              // compare Z-indices
    var zindexb = cstyleb.getPropertyValue("z-index");
    if (zindexa != zindexb) return(false);                          // different layers, fail
    if (recta.right - recta.left < 1) return(false);                // zero-width, ignore
    if (rectb.right - rectb.left < 1) return(false);                // zero-width, ignore
    if (!isnear(recta.left, rectb.left, tol) || !isnear(recta.right, rectb.right, tol)) return(false); // not aligned in h
                                                                    // ***TEMP*** skip vertical check
    ////if (isnear(recta.top, rectb.bottom, tol)) return(true);         // a is below b
    ////if (isnear(rectb.top, recta.bottom, tol)) return(true);         // b is below a
    return(false);                                                  // not adjacent
}
//
//  class Resultlink  --  corresponds to one DOM element representing a ratable link.
//
//
//  Constructor
//
function Resultlink(elt, domain, linkpurpose, rateable) 
{   this.elt = elt;                             // DOM element (an A tag)
    this.domain = domain;                       // Domain associated with A element
    this.linkpurpose = linkpurpose;             // "AD", "SEARCH", etc., for later deletion, sort, etc. 
    this.rateable = rateable;                   // true if link can be rated
    this.basedomain = basedomain(domain);       // use base domain for merge
    this.boxelt = null;                         // haven't determined box element yet
    this.stopelt = elt;                         // no stop element yet
    this.conflictlink = null;                   // debug info - parent elt that stopped search
    this.depth = 0;                             // no depth yet
    this.domdeleted = false;                    // true if boxelt deleted from DOM
    this.rating = null;                         // Rating "A", "Q", etc.
    this.ratingreply = null;                    // {ratinginfo: "no_website", location: "NEW YORK CITY"} , etc.
    this.sortkey = null;                        // numeric key for sorting/ranking
    this.sortseq = null;                        // sort sequence for stable sort
    this.parents = new Array();                 // set of all parents
    var workelt = elt;                          // initial elt being worked on
    var runawaycount = 0;                       // prevent infinite loop if defective DOM
    while (!((workelt === null) || (workelt === undefined)))    // all the way up the parent tree
    {   this.parents.push(workelt);             // accum all parents up to root
        workelt = workelt.parentNode;           // up one level of tree
        runawaycount = runawaycount + 1;
        if (runawaycount > 1000)                // if can't find parent
        {   console.error("ERROR: Parent loop in DOM");// big trouble
            break;
        }
    }
    //  Find "stop element", the "top" item of this link.
    //  The stop element is either one below the "stop tag" (often an LI)
    //  or is the first block-type DIV encountered.
    workelt = elt;                              // start at current elt
    var prevelt = null;                         // previous elt
    while (!isstoptag(workelt) && !isblockdiv(prevelt)) // until stop tag
    {   this.stopelt = workelt;                 // stopelt is one below stoptag
        this.depth = this.depth + 1;            // depth increases   
        prevelt = workelt;                      // save previous elt
        workelt = workelt.parentNode;           // move up a level
                  
    }
}
//
//  setpurpose -- set link purpose
//
Resultlink.prototype.setpurpose = function(linkpurpose)
{
    this.linkpurpose = linkpurpose;             // "AD", "SEARCH", etc., for later deletion, sort, etc.
}
//
//  setrating --  set rating 
//
Resultlink.prototype.setrating = function(rating, ratingreply, sortkey)
{   this.rating = rating;                       // set rating ("A", etc.)
    this.ratingreply = ratingreply;
    this.sortkey = sortkey;                     // sort key calculated by caller
}

//
//  mergeablechild  --  true if resultlink can be merged with last useful resultlink
//
//  Items are mergeable if peer or child and have the same base domain.
//
//  Called before boxelts set.  Use stopelt.
//
Resultlink.prototype.mergeablechild = function(last) 
{   if (last === null) return(false);           // cannot merge if null
    if (this.stopelt != last.stopelt && !this.isinparents(last.stopelt)) return(false); // not peer or child of last
    if (this.basedomain == last.basedomain) return(true);   // domains match, mergeable
    if (!this.rateable) return(true);           // if not rateable domain, OK to merge
    if (!last.rateable) return(true);           // non-rateable domains are trackers, house links, etc.
    return(false);                              // cannot merge, distinct domains
}
//
//  mergeablepeer  --  true if resultlink can be merged with last useful resultlink
//
//  Items are mergeable if peer has the same base domain
//
//  Called after boxelts set, and uses boxelts.
//
Resultlink.prototype.mergeablepeer = function(last) 
{   if (last === null) return(false);           // cannot merge if null
    if (this.boxelt === null || last.boxelt === null) return(false);    // not null, fails
    if (this.boxelt.parentNode !== last.boxelt.parentNode) return(false); // not peer of last
    if (this.basedomain == last.basedomain) return(true);   // domains match, mergeable
    ////if (!this.rateable) return(true);           // if not rateable domain, OK to merge
    ////if (!last.rateable) return(true);           // non-rateable domains are trackers, house links, etc.
    return(false);                              // cannot merge, distinct domains
}
//
//  isinparents --  test membership of element in parents set
//
//  This ought to be a hash, but elts aren't hashable.
//  Hence the linear search.
//
Resultlink.prototype.isinparents = function(elt) 
{   if (elt === undefined || elt === null) return(false);               // fails by default
    for (var i=0; i < this.parents.length; i++)                         // linear search (slow)
    {   if (this.parents[i] === elt) return(true);  }                   // find
    return(false);                                                      // no find
}

//
//  finddominator -- find dominator of two resultlink elements.
//
//  The element one below the dominator is the most likely box element.
//
//  We check prev vs. current, and next vs. current, and take the deepest
//  depth. 
//
//  Returns index into parent elements of "this" of the dominator.
//
//  Example: 
//           this parents: (A, B, C, D)
//          other parents: (X, Y, Z, C, D)          so dominator is C, index 2 of "this"
//      thislen = 4
//      otherlen = 5
//      offset = 1
//  compare this[0] vs other[1], this[1] vs other[2], this[2] vs other[3] - find at 2.
//
Resultlink.prototype.finddominator = function(other)
{   if (other === null) return null;                    // no other
    //  The parent list for an element is ordered with the deepest element first.
    var offset = other.parents.length - this.parents.length;    // lists line up at end, not beginning.  Hence offset.
    for (var i = offset; i < this.parents.length; i++)  // check parents of this; start at offset to avoid subscript error
    {   if (i + offset >= other.parents.length) break;  // reached end of other with no find
        if (i < 1 || (i + offset < 1)) continue;        // no elt above item yet
        if (this.parents[i] === other.parents[i+offset])// if elements match, found dominator
        {   var thisbelow = this.parents[i-1];
            var otherbelow = other.parents[i + offset -1];            
            if (prefs.verbosepref)
            {   console.log("Found dominator " + node_to_string(this.parents[i]) + " of " 
                + node_to_string(this.elt) + " and " + node_to_string(other.elt)
                + " for domain " + this.domain); 
            }
            if (isvadjacent(thisbelow, otherbelow)) return(i);   // win
            if (prefs.verbosepref)
            {   console.log("Boxes around " + node_to_string(thisbelow) + " and " + node_to_string(otherbelow) 
                + " not adjacent - cannot use dominator.");
            }
            return(null);                               // fail
        }
    }
    if (prefs.verbosepref)
    {   console.log("Unable to find dominator of " 
        + node_to_string(this.elt) + " and " + node_to_string(other.elt)
        + " for domain " + this.domain); 
    }
    return(null);                                       // no find
}
//
//  findbelowdominator -- find deepest dominator of resultlink elements.
//
//  The element one below the dominator is the most likely box element.
//
//  We check prev vs. current, and next vs. current, and take the deepest
//  depth. 
//
//  Returns dom element one in parents of "this" one deeper than dominator. 
//
Resultlink.prototype.findbelowdominator = function(prev, next)
{
    var prevdomix = this.finddominator(prev);                   // get dominator index of this and prev, or null
    var nextdomix = this.finddominator(next);                   // get dominator index of this and next, or null
    var domix = null;
    if (prevdomix === null) { domix = nextdomix; }
    else if (nextdomix === null) { domix = prevdomix; }
    else { domix = Math.min(nextdomix, prevdomix) }             // if both present, use minimum (deepest) result
    if (domix !== null && domix > 0)                            // if found dominator and one below it
    {   return(this.parents[domix-1]);                          // return one below dominator
    }
    return(null)
}
//
//  setboxelt2 -- find block element which defines the box around the ad or search result.
//
//  New algorithm.
//
//  Returns boxelt or null.
//
Resultlink.prototype.setboxelt2 = function(prev, next)
{   var workelt = this.findbelowdominator(prev, next);          // find element below dominator or null
    if (prefs.verbosepref) 
    {   console.log("Setboxelt2 for " + this.domain + " has dominator " + node_to_string(workelt));     }
    if (workelt === null) return(null)                          // if got nothing
    var computedstyle = document.defaultView.getComputedStyle(workelt, null);    // get style
    var position = computedstyle.getPropertyValue("position");
        ////var displaystyle = computedstyle.getPropertyValue("display");    // get display attr
        ////var zindex = computedstyle.getPropertyValue("z-index");
        ////MAY NEED TO CHECK ZINDEX
    if (position == "absolute")                                 // if absolute positioning, don't consider
    {   return(null); }                                         // do not box absolute positioned popups
    if (prev && prev.rateable && prev.isinparents(workelt))    // if parent of prev, too high in DOM tree.
    {   this.conflictlink = prev; return(null); }               // record elt that stopped search for debug
    if (next && next.rateable && next.isinparents(workelt))    // if parent of next, too high in DOM tree
    {   this.conflictlink = next; return(null); }               // record elt that stopped search for debug
    return(workelt);                                            // success
}
//
//  setboxelt -- find block element which defines the box around the ad or search result.
//
//  Algorithm:
//  - find highest element above this which 
//      - is not a stop elt
//      - is not a parent (recursively) of prev.boxelt (skip if prev is null)
//      - is not a parent (recursively) of next (skip if next is null)
//      - is a block element
//  This is the boxelt, around which a box will be constructed.
//  Log error if boxelt cannot be determined.
//
//  Next or prev may be null, and will be for the first and last items.
//
Resultlink.prototype.setboxelt = function(prev, next) 
{   
    //  Try dominator-based algorithm first.  This only works for groups of similar items blocked together.
    var workelt = this.setboxelt2(prev, next);
    if (workelt) 
    {   this.boxelt = workelt;                                  // have a boxelt
        if (prefs.verbosepref)
        {   console.log("Found enclosing boxelt via dominator test. Domain: " + this.domain); }
        return                                                  // done    
    }
    //  Dominator approach failed, try second algorithm.  This works for singletons.  
    workelt = this.elt;                                         // working upward in DOM
    while (!isstoptag(workelt))
    {   var computedstyle = document.defaultView.getComputedStyle(workelt, null);    // get style
        var position = computedstyle.getPropertyValue("position");
        ////var displaystyle = computedstyle.getPropertyValue("display");    // get display attr
        ////var zindex = computedstyle.getPropertyValue("z-index");
        ////MAY NEED TO CHECK ZINDEX
        if (position == "absolute")                             // if absolute positioning, don't consider
        {   this.boxelt = null; return; }                       // do not box absolute positioned popups
        if (prev && prev.rateable && prev.isinparents(workelt)) // if parent of prev, too high in DOM tree.
        {   this.conflictlink = prev; break; }                    // record elt that stopped search for debug
        if (next && next.rateable && next.isinparents(workelt)) // if parent of next, too high in DOM tree
        {   this.conflictlink = next; break; }                    // record elt that stopped search for debug
        if (containsblockelt(workelt,0))                        // if block element (EXPENSIVE TEST)
        {   this.boxelt = workelt;  }                           // potential box elt, and keep trying      
        if (workelt === this.stopelt) break;                     // if at stopelt, done
        workelt = workelt.parentNode;                           // move up the DOM tree               
    }
    if (this.boxelt === null)                                   // if unable to box
    {   if (prefs.verbosepref)
        {   console.log("Unable to find enclosing box for ad or search result. Domain: " + this.domain);
            this.dump();                                        // happens whenever there are inline ad items
        }
    }
}
//
//  isprevbox -  true if ritem is previous box of this
//
//  Whitespace and comments between the siblings don't count.
//  Some search engine results have comments or whitespace between LI items.
//
Resultlink.prototype.isprevbox = function(ritem)
{   if (!ritem || !ritem.boxelt || !this.boxelt) return(false); // no box items to compare
    if (this.boxelt.parentNode != ritem.boxelt.parentNode) return(false); // not siblings, fail
    var workelt = this.boxelt.previousSibling;                  // start looking at previous sibling
    while (workelt)                                             // work back through siblings
    {   if (workelt === ritem.boxelt) return(true);             // success
        if (!iswhitespace(workelt)) return(false);              // we only skip over whitespace items
        workelt = workelt.previousSibling;                      // go back in prev direction
    }
    return(false);                                              // not prev box, fail
}
//
//  isnextbox -  true if ritem is previous box of this
//
//  Whitespace and comments between the siblings don't count.
//
Resultlink.prototype.isnextbox = function(ritem)
{   if (!ritem || !ritem.boxelt || !this.boxelt) return(false); // no box items to compare
    if (this.boxelt.parentNode != ritem.boxelt.parentNode) return(false); // not siblings, fail
    var workelt = this.boxelt.nextSibling;                      // start looking at next sibling
    while (workelt)                                             // work back through siblings
    {   if (workelt === ritem.boxelt) return(true);             // success
        if (!iswhitespace(workelt)) return(false);              // we only skip over whitespace items
        workelt = workelt.nextSibling;                          // go forward in next direction
    }
    return(false);                                              // not next box, fail
}
//
//  domdelete --  delete this object from DOM
//
//  Dumb version - deleted entire object.
//  We may have to go through the object and retain any SCRIPT items
//  to deal with sites that try to fight manipulation.
//
Resultlink.prototype.domdelete = function()
{   if (this.domdeleted) return;                                // already deleted
    if (this.boxelt === null) return;                           // nothing to delete
    if (this.boxelt.parentNode === null) return;                // can't delete top node
    ////alert("About to delete ad for " + this.domain + "  Box elt: " + node_to_string(this.boxelt))
    this.boxelt.parentNode.removeChild(this.boxelt);            // remove node
    this.domdeleted = true;                                     // now deleted
}
//
//  dump -- dump object to log
//
Resultlink.prototype.dump = function() 
{   
    var s = "Resultlink(elt=" + node_to_string(this.elt) + "  domain=" + this.domain + 
            "  stopelt=" + node_to_string(this.stopelt) + 
            "  boxelt=" + node_to_string(this.boxelt) +
            "  conflictlink=" + (this.conflictlink ? this.conflictlink.domain : "None") +
            "  depth=" + this.depth + 
            "  domdeleteted=" + this.domdeleted +
            "  linkpurpose=" + this.linkpurpose +
            "  rateable=" + this.rateable +
            "  sortkey=" + this.sortkey +
            "  parents=";
    for (var i=0; i < this.parents.length; i++){ s += (node_to_string(this.parents[i]) + " "); }     // dump parents too
    s += ")";
    console.log(s);                              // log
}
//
//  displayboxoutline --  outline the boxelt of an item for debug purposes
//
//  A dashed blue line is added arounc the boxelt. 
//  If there's an adjacent Resultlink item, the side with that item is
//  displayed as a thin dotted line.  This results in a display
//  of groups of adjacent Resultlink items.
//
Resultlink.prototype.displayboxoutline = function(prevadj, nextadj)
{
    if (!this.boxelt) return;                               // skip if no box elt
    var boxcl = "stboxnoadj";                               // mark adjacent boxes
    if (prevadj && nextadj) { boxcl = "stboxbothadj"; }     // add appro
    else if (prevadj) { boxcl = "stboxprevadj"; }
    else if (nextadj) { boxcl = "stboxnextadj"; }
    addclass(this.boxelt, boxcl);                           // add blue box class
    if (!resultlinkcssloaded)                               // load CSS for display
    {   addGlobalStyle(document, resultlinkcss);
        resultlinkcssloaded = true;
    }      
}
//
//  class Resultlinkblock --  a group of adjacent Resultlink items.
//
//  Within a block, items can be reordered.
//
//
//  Constructor
//
function Resultlinkblock(elt, domain) 
{   this.resultlinks = [];                                    // no resultlinks yet
}
//
//  addrlink  --  add a Resultlink
//
Resultlinkblock.prototype.addrlink = function(rlink)
{   this.resultlinks.push(rlink); }                           // add a rate link
//
//  displayboxoutline --  outline the boxelt of an item for debug purposes
//
Resultlinkblock.prototype.displayboxoutline = function()
{   for (var i=0; i < this.resultlinks.length; i++)           // for all links in block
    {   var ritem = this.resultlinks[i];                      // item to do
        ritem.displayboxoutline(i > 0, i < this.resultlinks.length -1);   // display, handling block start and end
    }
}
//
//  class Resultlinkpage --  all the resultlinks on a page
//
function Resultlinkpage()
{   this.inputresultlinks = new Array();                        // input Resultlink items
    this.mergedresultlinks = null;                              // merged Resultlink items
    this.blocks = null;                                         // Resultlinkblock items
    this.adcount = null;                                        // used by external ad counter
}
//
//  push  --  add a Resultlink
//
Resultlinkpage.prototype.push = function(rlink)
{   this.inputresultlinks.push(rlink); }                          // add a rate link
//
//  setboxelts -- set box elts for an array of Resultlinks
//
//  In-place update
//
Resultlinkpage.prototype.setboxelts = function()
{   for (var i=0; i < this.mergedresultlinks.length; i++)       // for all in input
    {   var prev = null;                                        // previous item
        if (i > 0) prev = this.mergedresultlinks[i-1];          // if any
        var next = null;                                        // next item
        if (i < this.mergedresultlinks.length-1) next = this.mergedresultlinks[i+1];      // if any
        this.mergedresultlinks[i].setboxelt(prev, next);        // calc box elt for current item
    }
}
//
//  mergelinks  --  merge rate links if one can be subsumed into the one above it
//
//  Creates a new array with the links merged out.
//
Resultlinkpage.prototype.mergelinks = function(inlinks) 
{   //  Merge mergeable links
    var outlinks = new Array();                             // new merged elts
    var last = null;                                        // last one we saved
    for (var i=0; i < inlinks.length; i++)                  // for all in input
    {   var curr = inlinks[i];                              // current item
        if (!curr.mergeablechild(last))                     // if not mergeable
        {   outlinks.push(curr);                       // keep it
            ////console.log("Mergelinks check kept: " + curr.domain); // ***TEMP***
            last = curr;                                    // this is new last item
        }
    }
    return(outlinks);
}   
//
//  mergepeerlinks  --  merge rate links if one can be subsumed into the one above it
//
//  Creates and returns a new array with the links merged out.
//
Resultlinkpage.prototype.mergepeerlinks = function(inlinks) 
{   //  Merge mergeable links
    var outlinks = new Array();                             // new merged elts
    var last = null;                                        // last one we saved
    for (var i=0; i < inlinks.length; i++)                  // for all in input
    {   var curr = inlinks[i];                              // current item
        if (!curr.mergeablepeer(last))                      // if not mergeable
        {   outlinks.push(curr);                            // keep it
            ////console.log("Mergepeer check kept: " + curr.domain); // ***TEMP***
            last = curr;                                    // this is new last item
        }
    }
    return(outlinks);
}
//
//  buildblocks  --  build Resultlinkblock groups of adjacent boxes
//
//  Called after all Resultlinks added.
//
//  ***MAY NEED TO DETECT CONTAINED ITEMS, THEN SET BOX ELTS, THEN MERGE PEER ITEMS***
//
Resultlinkpage.prototype.buildblocks = function()
{   this.mergedresultlinks = this.mergelinks(this.inputresultlinks);  // merge links first
    this.setboxelts();                                          // then compute boxelts
    this.mergedresultlinks = this.mergepeerlinks(this.mergedresultlinks);   // second merge, of peers
    this.blocks = new Array();                                  // start the array of blocks
    var currblock = null;                                       // no current block yet
    for (var i=0; i < this.mergedresultlinks.length; i++)       // for all resultlinks
    {   var rlink = this.mergedresultlinks[i];                  // current Ratinglink
        if (!rlink.boxelt) continue;                            // skip if no box elt
        var prevadj = false;                                    // is previous box adjacent?
        if (i > 0) prevadj = rlink.isprevbox(this.mergedresultlinks[i-1]);
        if (!prevadj)                                           // if not adjacent, start new block
        {   currblock = new Resultlinkblock();                  // create new block
            this.blocks.push(currblock);                        // add to blocks
        }
        //  currblock will not be null because prevadj is always false for i=0;
        currblock.addrlink(this.mergedresultlinks[i]);          // add to block 
    }
}
//
//  ritemcompare -- sort compare fn for ritems
//
function ritemcompare(a, b)
{   if (a.sortkey > b.sortkey) return(1);                       // a wins
    if (a.sortkey < b.sortkey) return(-1);                      // b wins
    return(a.sortseq - b.sortseq);                              // make sort order-preserving
}
//
//  domdelete -- delete by linkpurpose
//
//  Used to make some or all all ads go away
//  Skipcount is the number of ads to skip before deleting. 
//  
//  Elements with higher sortkeys are deleted first. 
//
Resultlinkpage.prototype.domdelete = function(linkpurpose, skipcount)
{   //  Find ad items for potential deletion
    var sortwork = new Array();                                 // sorted list of ads
    for (var i=0; i < this.mergedresultlinks.length; i++)       // for all merged links
    {   var rlink = this.mergedresultlinks[i];
        if (rlink.linkpurpose != linkpurpose) continue;         // ignore if not specified purpose (AD)
        if (!rlink.rateable) rlink.sortkey = 999;               // down-rate unrateable items (bulk ads) to bottom of sort.  
        rlink.sortseq = sortwork.length;                        // to make sort order preserving
        sortwork.push(rlink);                                   // accumulate items to consider
    }
    if (prefs.verbosepref)
    {   console.log("Deleting " + linkpurpose + ".  Skipping " + skipcount  + " of " + sortwork.length + " items to delete.");}
    sortwork.sort(ritemcompare);                                // sort items, best ones first
    //  Delete the losers
    for (var i=0; i < sortwork.length; i++)                     // for items picked above
    {   var rlink = sortwork[i];
        if (skipcount > 0)                                      // if ads to skip not used up
        {   skipcount--;                                        // allow this ad
            if (prefs.verbosepref)
            {   console.log("  Keeping  " + rlink.domain + " (" + rlink.rating + "): " + rlink.elt.href);}
            continue                                            //
        }
        if (prefs.verbosepref)
        {   console.log("  Deleting "  + rlink.domain + " (" + rlink.rating + "): " + rlink.elt.href);}
        rlink.domdelete();                                      // delete this ad
    }
}
//
//  displayboxoutline --  outline the boxelt of an item for debug purposes
//
Resultlinkpage.prototype.displayboxoutline = function()
{   for (var i=0; i < this.blocks.length; i++)                  // for all links in block
    {   this.blocks[i].displayboxoutline(); }                   // do box outlines
}
//
//  Unit test
//

//
//  dumpratelnks -- dumps an array of references to Resultlink items
//
function dumpresultlinks(resultlinks, msg)
{   console.log(msg + " (" + resultlinks.length + " items).");
    for (var i=0; i < resultlinks.length; i++)                  // for all in input
    {   resultlinks[i].dump();                                  // dump new item
    }
}

//
//  Preliminary test function, for use before we create array of Resultlink in caller. 
// 
function testresultlink(page)
{   if (prefs.verbosepref) console.log("Begin testresultlink.");
    if (prefs.verbosepref) dumpresultlinks(page.inputresultlinks,"Initial dump");
    page.buildblocks();                                         // where all the work gets done
    if (prefs.verbosepref) dumpresultlinks(page.mergedresultlinks, "\nMerged items with boxelts set");
    if (prefs.outlinepref) page.displayboxoutline();            // display the box outlines
    if (prefs.adpref == 0)                                      // if full ad block
    {   page.domdelete("AD");   }                               // delete all ads
    if (prefs.verbosepref) console.log("End testresultlink.");
}