//
//  prefspanelchrome.js  -- preferences panel support for Ad Limiter
//
//  Chrome now prohibits JavaScript in option pages, so this has to be separate.
//
var KPREFSKEY = "P";								    // local storage name for prefs

//
//	onload  --  get existing prefs at page load
//
//  If no prefs are stored, use prefs from page HTML
//
function onload()
{	//	Resize window to dialog-box size.
	/////window.resizeTo(480,320);						// doesn't work.
	//	Initialize prefs form.
	function gotprefs(item) {
    	var form = document.forms["prefsform"];				// the prefs form to update	
    	var prefstr = item[KPREFSKEY];				        // get prefs
	    console.log("Read prefs: " + prefstr); // ***TEMP***
    	if (prefstr === undefined || prefstr === null) return;	// if no stored prefs, skip
    	var prefs = JSON.parse(prefstr);					// parse prefs, which are a JSON string
    	if (prefs === undefined || prefs === null) return;	// if no stored prefs, skip
    	//	Set form preferences from stored preferences.
    	form['verbosepref'].checked = prefs.verbosepref;
    	form['outlinepref'].checked = prefs.outlinepref;
    	form['adpref'].value = prefs.adpref;
    	form['searchpref'].value = prefs.searchpref;
    }
    function storageerror()                             // fetch error, go back to defaults
    {   gotprefs({});   }
    browser.storage.local.get(KPREFSKEY).then(gotprefs, storageerror);
}
//
//	updateprefs  --   update add-on preferences on "OK"
//
function updateprefs()
{	var form = document.forms["prefsform"];	
	var prefs = {									    // construct storeable prefs value
		verbosepref: form['verbosepref'].checked,
		outlinepref: form['outlinepref'].checked,
		adpref: form['adpref'].value,
		searchpref: form['searchpref'].value
		};
    var prefsitem = {};                                 // build prefs here
	prefsitem[KPREFSKEY] = JSON.stringify(prefs);	    // save prefs
	console.log("Setting prefs: " + prefsitem[KPREFSKEY]); // ***TEMP***
	browser.storage.local.set(prefsitem);               // set prefs
	window.close();										// treat as dialog and close window.
	return(true);										// submit form, which does nothing here.
}
//
//	docancel  --  handle cancel button.
//
//	Just closes window
//
function docancel()
{	window.close();	}									// treat as dialog and close window
//
//  Initialization - triggered when DOM of prefs page is created and loaded.
//
document.addEventListener('DOMContentLoaded', function () {
    onload();                                               // do startup processing
    var cancelbutton = document.getElementById("cancel")
    cancelbutton.addEventListener("click",docancel);        // handle cancel button
    var updatebutton = document.getElementById("update")
    updatebutton.addEventListener("click",updateprefs);     // handle update button
});
