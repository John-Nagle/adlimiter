"use strict";

window.addEventListener("load", function() {
  // set up the appearance of the popup depending on the outcome of the opt-in
  browser.storage.local.get("optInShown", function(result) {
    console.log("Setting up UI. result.optInShown:" + result.optInShown);
    document.getElementById("opt-in-prompt").hidden = result.optInShown;
    document.getElementById("after-opt-in").hidden = !result.optInShown;
  });

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
      //    If the user confirms the remove, the add-on is gone, and there's nothing more to do.
        function removed() {window.close(); console.log("Ad Limiter removed.");}                                         // add-on was removed, nothing to do
        function kept() {}                                             // kept, will ask again
      //    If the user cancels the remove, the opt-in prompt will be shown again.
      browser.management.uninstallSelf({"showConfirmDialog":true, "dialogMessage": "Remove Ad Limiter add-on?"}).then(removed,kept);
      ////window.close();
  });
});
