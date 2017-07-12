//
//  getelementsbytagnamedefectworkaround.js  --  workaround for Mozilla bug
//
//  John Nagle
//  SiteTruth
//  October, 2011
//
//  License: LGPL
//
//  getElementsByTagNameDefectWorkaround  -- workaround for defect in getElementsByTagName
//
//  This is a workaround for Mozilla Bug #693076
//  Ref: https://bugzilla.mozilla.org/show_bug.cgi?id=693076
//  "elements.getElementsByTagName randomly returns 0 elements found"
//
//  Case-insensitive, for use with HTML, not XML.
//
//  Not particularly efficient, but not used on large subtrees.
//
function getElementsByTagNameDefectWorkaround(node, tag)
{   var nodes = [];                                     // no nodes yet
    var taglc = tag.toLowerCase();                      // compare in lower case
    if (node.childNodes && node.childNodes.length)      // do child nodes
    {   for (var i = 0; i < node.childNodes.length; i++)// for all child nodes
        {   var subnode = node.childNodes.item(i);      // get each child node
            if (subnode.nodeType != 1) continue;        // elements only
            if (subnode.nodeName.toLowerCase() == taglc)// if tag matches
            {   nodes.push(subnode); }                  // save matched node
            //  Recurse down DOM tree
            nodes = nodes.concat(getElementsByTagNameDefectWorkaround(subnode, tag));   
        }
    }
    return(nodes);
}