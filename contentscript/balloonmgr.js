//
//  balloonmgr.js  -- hover balloon manager
//
//  Assumes Javascript 1.5 or later.
//  No IE 6 or Netscape support.
//  Suitable for use in add-on content scripts.
//
//  John Nagle
//  March, 2012
//
//  Based loosely on Rich HTML Balloon Tooltip from Dynamic Drive.
//
"use strict";                                               // strict Javascript enforcement.
//
//	Configuration constants
//
var BALLOONHIDEDELAY = 1000;  							// Tooltip will disappear after this time interval (ms)
var BALLOONMARGIN = 15;                                 // Keep balloon this far from edge of window (px)
var BALLOONARROWHEADID = "balloonmgrarrowhead";         // ID of arrowhead item in CSS

//
//  class BalloonMgr  --  Manages a group of mouseover balloons
//
//  Only one balloon at a time can be visible.
//
//  Constructor
//
//  arrowheadimg:   arrowhead image URLs [dn, up]
//  marker: set this attribute to "t" on inserted elements for recognition.
//
function BalloonMgr(arrowheadimg, marker) 
{   this.arrowheadimg = arrowheadimg;                   // arrow head image URLs [dn, up]
    this.marker = marker;                               // used to make inserted items recognizable
    this.edgeoffsetx = 0;                               // offsets of balloon edges
    this.edgeoffsety = 0;
    this.balloonelt = null;                             // no balloon DOM element yet
    this.tiparrow = null;                               // no tip arrow yet
    this.showtimeout = null;                            // timeout object for show after mousein
    this.hidetimeout = null;                            // timeout object for hide after mouseout
}
//
//  geteltoffset -- get offset of DOM element from upper left corner of absolute positioning region
//
//  "absolute" positioning means relative to the first parent item with absolute positioning.
//  This supports objects tied to scrolling panes.
//
//  Based on "http://www.codeproject.com/Articles/35737/Absolute-Position-of-a-DOM-Element"
//  but without the obsolete browser hacks.
//
var __isWebKit =  navigator.appVersion.match(/WebKit/) != null; // SYSTEM DEPENDENCY
//
BalloonMgr.prototype.geteltoffset = function(elt)
{
    var viewportElement = document.documentElement;
    var box = elt.getBoundingClientRect();
    if (__isWebKit === true)                                // workaround for broken Chrome browsers
    {
        var scrollLeft = window.scrollX;
        var scrollTop = window.scrollY;
    } else {                                                // non-Webkit browsers
        var scrollLeft = viewportElement.scrollLeft;
        var scrollTop = viewportElement.scrollTop;
    }

	var hoffset = box.left + scrollLeft;
	var voffset = box.top + scrollTop;
    return([hoffset, voffset]);                             // return V and H offsets
}
//
//  makevisible  --  make visible on mouseover
//
BalloonMgr.prototype.makevisible = function(obj)
{   this.balloonelt.style.left = this.balloonelt.style.top="-500px";    // push far offscreen
    obj.visibility="visible";                           // make visible on mouse-over
}
//
//  repositionintowindow -- position balloon so as not to go off edge of the window.
//
//  The preferred location is below and to the right of the item being marked.
//
BalloonMgr.prototype.repositionintowindow = function(obj, wantv)
{
	if (!wantv)                                             // if want horizontal adjustment
	{	this.edgeoffsetx = 0;
		var windowedge = window.pageXOffset + window.innerWidth - BALLOONMARGIN;
		this.balloonelt.contentmeasure = this.balloonelt.offsetWidth;
		if (windowedge - this.balloonelt.x < this.balloonelt.contentmeasure)
		{   this.edgeoffsetx = this.balloonelt.contentmeasure-obj.offsetWidth; }
		if (this.balloonelt.x - this.edgeoffsetx + this.balloonelt.contentmeasure>windowedge)
        {   this.edgeoffsetx = this.balloonelt.x - windowedge + this.balloonelt.contentmeasure;   }
		return this.edgeoffsetx;
	} else {                                                // if want vertical adjustment
		this.edgeoffsety = 0;
		var topedge = window.pageYOffset;
		var windowedge = window.pageYOffset + window.innerHeight - BALLOONMARGIN;
        var arrowheight = (this.tiparrow) ? this.tiparrow.offsetHeight : 0;     // get height of arrow image
		this.balloonelt.contentmeasure = this.balloonelt.offsetHeight;
        //  If about to run off bottom of window, move to above item being marked.
		if (windowedge - this.balloonelt.y < this.balloonelt.contentmeasure) 
		{   this.edgeoffsety = this.balloonelt.contentmeasure + 2*(obj.offsetHeight + arrowheight);  }    // balloon above item
		return this.edgeoffsety;
	}
}
//
//	displayballoontip -- main balloon tooltip function
//
BalloonMgr.prototype.displayballoontip = function(obj, e, balloonelt)
{	if (window.event) 
    {   event.cancelBubble = true;  }                           // we are taking this event
	else if (e.stopPropagation)                                 // if stopPropagation supported 
    {  e.stopPropagation(); }
	if (this.balloonelt != null)                                // hide previous tooltip?
    {   this.balloonelt.style.visibility = "hidden";    }       // yes, hide
	this.cancelhidetimeout();
	this.balloonelt = balloonelt;                               // get balloon content of new balloon
	this.makevisible(this.balloonelt.style);
    //  Position the balloon in the window.
    var arrowheight = (this.tiparrow) ? this.tiparrow.offsetHeight : 0;     // get height of arrow image
    var eltoffsets = this.geteltoffset(obj);                    // x and y offsets of object
	this.balloonelt.x = eltoffsets[0];
	this.balloonelt.y = eltoffsets[1] + arrowheight;
	this.balloonelt.style.left = this.balloonelt.x - this.repositionintowindow(obj, false) + "px";
	this.balloonelt.style.top = this.balloonelt.y - this.repositionintowindow(obj, true) + obj.offsetHeight + "px";
	this.displaytiparrow();                                     // display arrow tip
}
//
//  displaytiparrow --  display arrow image above or below tooltip.
//
BalloonMgr.prototype.displaytiparrow = function ()
{	if (this.arrowheadimg == null) return;                          // ignore if no arrowheads
    this.tiparrow = document.getElementById(BALLOONARROWHEADID);
	this.tiparrow.src = (this.edgeoffsety!=0) ? this.arrowheadimg[0] : this.arrowheadimg[1];   // choose up or down arrow on balloon
    var left = parseInt(this.balloonelt.style.left);                // position of balloon, upper left corner
    var top = parseInt(this.balloonelt.style.top);
    //  Arrow at left or right end of balloon, as necessary.
	this.tiparrow.style.left = (this.edgeoffsetx!=0) ? 
        left + this.balloonelt.offsetWidth - this.tiparrow.offsetWidth - 5 +"px"       // arrow at right case
        : (left+5) + "px";                                           // usual arrow at left case
    //  Arrow peeks out from top or bottom of balloon, as necessary.
	this.tiparrow.style.top = (this.edgeoffsety!=0) ? 
        (top + this.balloonelt.offsetHeight) + "px"   
        : (top-this.tiparrow.offsetHeight) + "px";
	this.tiparrow.style.visibility = "visible";
    ////alert("Box at " + left + ", " + top + "  size " + this.balloonelt.offsetWidth + ", " + this.balloonelt.offsetHeight + "   Arrrow at " + this.tiparrow.style.left + ", " + this.tiparrow.style.top); // ***TEMP***
}
//
//  ballonshow  -- show balloon.  Triggered by mouseover or click.
//
BalloonMgr.prototype.balloonshow = function(obj, e, balloonelt)
{   
    this.displayballoontip(obj, e, balloonelt);                 // show the balloon
}
//
//  deferredballoonhide  --  hide balloon after mouseoff, but wait a bit first in case user is jittery.
//
BalloonMgr.prototype.deferredballoonhide = function(balloonelt)
{   var bmgr = this;                                                // balloon manager
    function hidetimeoutfn()                                        // closure called on timeout
    {   balloonelt.style.visibility = 'hidden';                     // hide the balloon
        balloonelt.style.left = 0; 
        if (bmgr.arrowheadimg) 
        {    bmgr.tiparrow.style.visibility = 'hidden';   }
    }
	this.hidetimeout=setTimeout(hidetimeoutfn, BALLOONHIDEDELAY);   // hides balloon after timeout
    ////alert("Mouseout event");
}
//
//  cancelhidetimeout -- cancel balloon hide timeout when no longer needed
//
BalloonMgr.prototype.cancelhidetimeout = function()
{	if (this.hidetimeout)                                           // if a timeout is pending
    {   clearTimeout(this.hidetimeout);                             // cancel timeout
        this.hidetimeout = null;                                    // no timeout
    }
}
//
//  getballoonelt -- returns DOM item for balloon if it has one
//
BalloonMgr.prototype.getballoonelt = function(atag, atagattr, cssstyle) 
{	if (atag.onmouseover) return(null);                             // already has a mouseover attached, skip
    var contentid = atag.getAttribute(atagattr);                    // does it have balloon content attached?
    if (contentid == null || contentid == "") return(null);         // no content ID
    var balloonelt = document.getElementById(contentid);            // DOM item to show as balloon
    if (balloonelt == null) return(null);                           // no DOM item
    if (balloonelt.className != cssstyle) return(null);             // no class item
    return(balloonelt);                                             // return DOM item to use
}
//
//  addballoon -- add a balloon to an A tag.
//
//  Called by createballoon and findballoons, but can also be called by user
//  if user has created a balloon element
//
BalloonMgr.prototype.addballoon = function(aelt, balloonelt)
{ 	var bmgr = this;                                                    // balloon manager object
    //  Create a mouseout closure on the A tag
    ////console.log("aelt.onmouseout = " + aelt.onmouseout);     // ***TEMP***
    if (aelt.onmouseout != undefined) aelt.onmouseout();    // if previously defined, cancel it
    aelt.onmouseout = function(e)
    {   bmgr.deferredballoonhide(balloonelt);   }
    //  Create a mouseover closure for the A tag
	aelt.onmouseover = function(e)
	{	var evtobj = window.event ? window.event : e;
		bmgr.balloonshow(this, evtobj, balloonelt);
	}
    //  Also create a click event. Mouseover events on mobile don't really work.
    aelt.onclick = function(e)
	{	var evtobj = window.event ? window.event : e;
		bmgr.balloonshow(this, evtobj, balloonelt);
	}

    //  Create a mouseout event to get rid of balloon on exit
    ////console.log("balloonelt.onmouseout = " + balloonelt.onmouseout);     // ***TEMP***
    if (balloonelt.onmouseout != undefined) balloonelt.onmouseout();    // if previously defined, cancel it
    balloonelt.onmouseout = function(e)
    {   bmgr.deferredballoonhide(balloonelt); }
    //  Create a mouseover event for the balloon itself, so it stays on screen for clicking
    balloonelt.onmouseover = function(e)
    {   var evtobj = window.event ? window.event : e;
        bmgr.cancelhidetimeout();
    }
}
//
//  Public functions
//
//
//  init  -- find all "a" links that need a tool tip.
//
//  Call after document loaded, or when document changes.
//
BalloonMgr.prototype.init = function()
{   //  Post-load initialization
    if (this.arrowheadimg && this.tiparrow == null)                     // if arrowheads being used
    {   this.tiparrow = document.createElement("img");                  // give it an IMG element
		this.tiparrow.setAttribute("src", this.arrowheadimg[0]);        // assume down arrow for now
        this.tiparrow.setAttribute("id", BALLOONARROWHEADID);           // sets class for arrowhead
		document.body.appendChild(this.tiparrow);
	}
}

//
//  createballoon   --  create a balloon item and attach it to an A tag.
//
//  Create a balloon data item, which is stored in a DIV.  Attach to
//  indicated A tag.
//
//  This includes a very limited template system for text balloons.
//    
//  textitems = [[textline, class], [textline, class] ...)
//      textline - Text line to display
//      class - CSS class for text line
//
//
BalloonMgr.prototype.createballoon = function(atag, style, textitems, link) 
{   this.init();                                        // in case it wasn't done yet
    var divitem = document.createElement("div");        // DIV of the balloon
    divitem.setAttribute("class", style);               // set class of DIV
    if (this.marker) { divitem.setAttribute(this.marker, "t");  }  // set marker attribute
    var balloonelt = divitem;                           // add content below here
    if (link)                                           // if entire balloon is a link
    {   var awelt = document.createElement("a");        // create A
        if (this.marker) { awelt.setAttribute(this.marker, "t");  }  // set marker attribute
        awelt.setAttribute("href", link);               // set link in A tag
        awelt.setAttribute("target", "_blank");         // open in new window
        divitem.appendChild(awelt);                     // DIV elt paretns A elt
        balloonelt = awelt;                             // add items below A elt
    }          
    for (var i=0; i < textitems.length; i++)
    {   var textitem = textitems[i];                    // this line
        //  Create DOM structure with lines of text each enclosed in a DIV.
        //  If link present, enclose text with A.
        //  If class present, set class on DIV
        var textelt = document.createTextNode(textitem[0]);// the text
        var newelt = textelt;                           // new elt to add
        var divelt = document.createElement("div"); // create DIV
        if (this.marker) { divelt.setAttribute(this.marker, "t");  }  // set marker attribute
        if (textitem.length > 1 && textitem[1] != null)
            divelt.setAttribute("class", textitem[1]);  // set class of span
        divelt.appendChild(newelt);
        newelt = divelt;
        balloonelt.appendChild(newelt);                 // add text line
    }
    document.body.appendChild(divitem);          // append hidden DIV at end
    this.addballoon(atag, divitem);              // attach balloon events
}
    
    