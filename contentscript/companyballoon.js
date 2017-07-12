//
//  companyballoon  -- format content of a SiteTruth company balloon/dogtag.
//
//  Part of the SiteTruth browser client.
//
//  John Nagle
//  May, 2012
//
//  Globals
//
"use strict";                                                               // strict mode
var ballooncssloaded = false;                                               // CSS not loaded yet
//
//  CSS
//
var ballooncss = ".stballoon { \
	position:absolute; \
	top: -500px; \
	left: 0; \
	visibility: hidden; \
	border:thick solid #2E2E2E; \
	line-height: 18px; \
	z-index: 1002; \
	width: 250px; \
	box-shadow: 10px 10px 5px rgba(0,0,0,0.5); \
	font-family: Verdana, Arial, Helvetica, sans-serif; \
	font-size: 12px; \
	font-style: normal; \
	font-weight: normal; \
	font-variant: normal; \
	border-radius: 50px; \
	background-position:left center; \
	background-image: url($DATADIRdogtag.png); \
	padding-top: 5px; \
	padding-right: 20px; \
	padding-bottom: 5px; \
	padding-left: 20px; \
    }\
    .stballoon a{ \
    color:black; \
    text-decoration: none \
    } \
    .stsmallitalic { \
    font-size: small; \
    font-style: italic; \
    } \
    .stwarning { \
    font-weight: bold; \
    font-style: italic; \
    color: red \
    } \
    .sttagcompanyid { \
	font-weight: bold; \
    } \
    .sttagdomain { \
	font-size: small; \
	font-weight: normal; \
	text-align: left; \
    } \
";
var balloonarrowheadcss = "#balloonmgrarrowhead { \
    z-index: 1001; \
    position:absolute; \
    top: -500px; \
    left: 0; \
    visibility: hidden; \
}";
var balloonlinkcss = ".stballoonlinktext {\
	font-family: Verdana, Arial, Helvetica, sans-serif;\
	font-size: x-small;\
	font-style: normal;\
	font-weight: bold;\
	text-align: right;\
}";
//
//  updateballoon  --  update info in mouseover balloon
//
//  "ratingreply" is an object with fields containing company name, etc.  
//
function updateballoon(markedelt, detailslink, domain, rating, ratingreply)
{   if (!gballoonmgr) return;                                   // if no balloon manager, skip
    ////if (markedelt.strating == rating) return;                   // if no change in rating, skip
    loadballooncss();                                           // balloon-related CSS loaded when needed
    //  Format balloon data
    var textitems = []                                          // [[text, class, link], ...]
    textitems.push([domain, "sttagdomain"])                     // Add domain item
	////console.log("Balloon update for " + domain + ": " + ratingreply.rating);	// ***TEMP***
	if (!ratingreply.rating)									// if no rating
	{	textitems.push([kratinginprogressmsg]);	}				// still rating
    if (ratingreply.matchconfidence && ratingreply.matchconfidence == "low")
    {   textitems.push(["Best guess:", "stsmallitalic"]); }     // note that this is best guess
	if (ratingreply.name)										// if business name present
	{	textitems.push([ratingreply.name, "sttagcompanyid"]);	} // name
    var addressline = "";                     					// LOCATION, STATE  COUNTRY
    if (ratingreply.location)
    {   addressline += ratingreply.location; }                  // "location" is city, etc.
    if (ratingreply.state) 
    {   addressline += ", " + ratingreply.state;    }
    if (ratingreply.countrycode) 
    {   addressline += "\u00a0\u00a0" + ratingreply.countrycode; }  // two non-breaking spaces, then country
	if (addressline != "")
    {	textitems.push([addressline.toUpperCase()])  }          // add the address line, UC per postal standards
    if (ratingreply.salesmin || ratingreply.salesmax)           // format sales numbers if present
    {   textitems.push(["Sales " + formatrange(ratingreply.salesmin, ratingreply.salesmax) + " " + ratingreply.salescurrency]);    }
    if (ratingreply.activesince) 
    {   textitems.push(["Active since (at least) " + ratingreply.activesince]); }
    if (ratingreply.ratinginfo)
    {   var s = ratingreply.ratinginfo.replace("_"," ")         // remove underscore from SQL enum value
        if (s != "") s = s.charAt(0).toUpperCase() + s.slice(1);// upper case first letter for humans
        textitems.push([s]);                                    // push resulting string
    }
    //  Notes and warnings, if provided by server.
    if (ratingreply.note)
    {   textitems.push([ratingitem.note, "stsmallitalic"]); }
    if (ratingreply.warning) 
    {   textitems.push([ratingitem.note, "stwarning"]);}
    //textitems.push(["SiteTruth profile", "stballoonlinktext", aelt.href]);     // details URL from A elt                                             
    gballoonmgr.createballoon(markedelt, "stballoon", textitems, detailslink); 	    // add balloon
    markedelt.strating = rating;                             	        // remember rating for change check 
    ////console.log("Updating balloon for " + domain);                  // ***TEMP*** 
}
//
//  subcss  --  do directory substitutions in CSS.
//
//  We need the name of the resource directory, but don't know that until run time.
//
function subcss(s)
{
    return(s.replace("$DATADIR", datadir));                             // fill in data directory
}
//
//  loadballooncss --  Load CSS for balloons
//
function loadballooncss() 
{   if (ballooncssloaded) return;                                       // already done
    addGlobalStyle(document, subcss(ballooncss));    
    addGlobalStyle(document, subcss(balloonarrowheadcss));
    addGlobalStyle(document, subcss(balloonlinkcss));                   
    ballooncssloaded = true;                                            // now loaded
}
