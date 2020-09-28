"use strict";
    
window.addEventListener("load", function() {

    // Set up the appearance of the pop-up depending upon
    // whether this is a new install or an upgrade
    console.log("Loaded popup");// ***TEMP***
    browser.storage.local.get("T")                                  // were there old cache entries?
    .then(function(result) { console.log("Got T: %o",result); document.getElementById("upgrade-info").hidden = !("T" in result); });   // upgrade if T present

    document.getElementById("button-enable").addEventListener(
    "click",
    function() {
      browser.storage.local.set({"optIn" : true, "optInShown" : true });
      window.close();
  });

    document.getElementById("button-cancel").addEventListener(
    "click",
    function() {
      browser.storage.local.set({"optIn" : false, "optInShown" : false });         // either we get removed or have to do this again
      function kept() {}                                             // kept, will ask again. Don't have to do anything here.
      //    This brings up an alert.
      //    If the user approves the uninstall; we're done and can do nothing further here.
      //    If the user cancels the uninstall, the opt-in prompt is still available for another try..
      browser.management.uninstallSelf({"showConfirmDialog":true}).catch(kept);
  });
});
