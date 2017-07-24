//
//  prefspanelchrome.js  -- preferences panel support
//
//  Chrome now prohibits JavaScript in option pages, so this has to be separate.
//
var kprefsname = "PREFS";								// local storage name for prefs
//
//	onload  --  get existing prefs at page load
//
function onload()
{	//	Resize window to dialog-box size.
	/////window.resizeTo(480,320);						// doesn't work.
	//	Initialize prefs form.
	var form = document.forms["prefsform"];				// the prefs form to update	
	var prefstr = localStorage[kprefsname];				// get prefs
	if (prefstr === undefined || prefstr === null) return;	// if no stored prefs, skip
	var prefs = JSON.parse(prefstr);					// parse prefs, which are a JSON string
	if (prefs === undefined || prefs === null) return;	// if no stored prefs, skip
	//	Set form preferences from stored preferences.
	form['verbosepref'].checked = prefs.verbosepref;
	form['outlinepref'].checked = prefs.outlinepref;
	form['adpref'].value = prefs.adpref;
	form['searchpref'].value = prefs.searchpref;
}
//
//	updateprefs  --   update add-on preferences
//
function updateprefs()
{	var form = document.forms["prefsform"];	
	var prefs = {									// consttruct storeable prefs value
		verbosepref: form['verbosepref'].checked,
		outlinepref: form['outlinepref'].checked,
		adpref: form['adpref'].value,
		searchpref: form['searchpref'].value
		};
	localStorage[kprefsname] = JSON.stringify(prefs);	// save prefs
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
    var updatebuttonbutton = document.getElementById("update")
    cancelbutton.addEventListener("click",updateprefs);     // handle cancel button
});
