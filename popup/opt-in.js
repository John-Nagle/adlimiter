"use strict";

window.addEventListener("load", function() {
  // set up the appearance of the popup depending on the outcome of the opt-in
  /*
  browser.storage.local.get("optInShown", function(result) {
    console.log("Setting up UI. result.optInShown:" + result.optInShown);
    document.getElementById("opt-in-prompt").hidden = result.optInShown;
    document.getElementById("after-opt-in").hidden = !result.optInShown;
  });
  */

  document.getElementById("button-enable").addEventListener(
    "click",
    function() {
      browser.storage.local.set({ "optIn" : true, "optInShown" : true });
      window.close();
  });

  document.getElementById("button-cancel").addEventListener(
    "click",
    function() {
      browser.storage.local.set({ "optIn" : false, "optInShown" : false });         // either we get removed or have to do this again
      function kept() {}                                             // kept, will ask again. Don't have to do anything here.
      //    This brings up an alert.
      //    If the user approves the uninstall; we're done and can do nothing further here.
      //    If the user cancels the uninstall, the opt-in prompt is still available for another try..
      browser.management.uninstallSelf({"showConfirmDialog":true}).catch(kept);
  });
});
