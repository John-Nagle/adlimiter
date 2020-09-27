"use strict";

const OPTINSTORAGE = "optIn";                   // name of opt-in storage tag.

window.addEventListener("load", function() {

  document.getElementById("button-enable").addEventListener(
    "click",
    function() {
      browser.storage.local.set({ OPTINSTORAGE : true, "optInShown" : true });
      window.close();
  });

  document.getElementById("button-cancel").addEventListener(
    "click",
    function() {
      browser.storage.local.set({ OPTINSTORAGE : false, "optInShown" : false });         // either we get removed or have to do this again
      function kept() {}                                             // kept, will ask again. Don't have to do anything here.
      //    This brings up an alert.
      //    If the user approves the uninstall; we're done and can do nothing further here.
      //    If the user cancels the uninstall, the opt-in prompt is still available for another try..
      browser.management.uninstallSelf({"showConfirmDialog":true}).catch(kept);
  });
});
