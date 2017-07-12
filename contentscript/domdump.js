//
//  Dump subtree of DOM into log.
//
//  For add-on debugging.
//
//  node-to-string -- Simple elt to string conversion for debug output
//
//  Outputs
//      <div id="id1" class="someclass">
//
//  Only ID and class are edited; those are usually enough to identify the item in the DOM,
//  and don't take up too much space.
//
function node_to_string(node) 
{   if (node === undefined) return("undefined"); 
    if (node === null) return("null");                // null node
    if (node.nodeType != 1 && node.nodeType != 3) { // non-element node
        var node_type = node_types[node.nodeType].toLowerCase ();
        return '(' + node_type + ')';
    }
    s = "<"
    s += node.nodeName;                         // node name
    var nodeclass = node.getAttribute("class");
    var nodeid = node.getAttribute("id");
    if (nodeclass) 
    {   s += ' class="' + nodeclass + '"'   }
    if (nodeid) 
    {   s += ' id="' + nodeid + '"'   }
    s += ">"
    return(s)                                   // display form
}
//
//  dom_dump  --  dump a portion of the DOM into the log
//
function dom_dump(node, msg)
{
    if (msg) console.log(msg);                                           // header msg if any
    traverse_nodes(node, 1);                                        // recursive descent
}
//
//  Node types
//
var node_types = [
    "FAKE NODE", // fix array offset
    "ELEMENT NODE",                     // 1
    "ATTRIBUTE NODE",                   // 2
    "TEXT NODE",                        // 3
    "CDATA SECTION NODE",
    "ENTITY REFERENCE NODE",
    "ENTITY NODE",
    "PROCESSING INSTRUCTION NODE",
    "COMMENT NODE",
    "DOCUMENT NODE",
    "DOCUMENT TYPE NODE",
    "DOCUMENT FRAGMENT NODE",
    "NOTATION NODE"
];

//
//  format_attributes --  format attributes of node
//
function format_attributes(node)
{   var s = "";
    if (node.attributes && node.attributes.length) 
    {   for (var i = 0; i < node.attributes.length; i++)
        {   var attr = node.attributes.item(i);
            s += attr.nodeName + ' = "' + attr.nodeValue + '" ';
        }
    }
    return(s);
}
//  traverse_nodes -- descend recursively from starting node
//
function traverse_nodes (node, depth) 
{   var s = ""
    for (var i=0; i < depth; i++) { s += "  ";}      // indent for depth
    if (node.nodeType == 1)
        s += "<" + node.nodeName + "> ";
    else
        s += node.nodeName + " ";
    if (node.nodeType != 1 &&
        node.nodeType != 3) {
        var node_type = node_types[node.nodeType].toLowerCase ();
        s += '(' + node_type + ') ';
    }
    s += format_attributes(node);
    console.log(s);                                          // output this node
    if (node.childNodes && node.childNodes.length)      // do child nodes
    {   for (var i = 0; i < node.childNodes.length; i++)
        {    traverse_nodes (node.childNodes.item(i), depth + 1);   }
    }
}