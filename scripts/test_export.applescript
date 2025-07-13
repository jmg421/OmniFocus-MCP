tell application "OmniFocus" to activate

tell application "OmniFocus"
    if not (exists document) then
        parse tasks into default document with transport text "Temp Task to Open Document"
        delay 1
    end if
end tell

-- Hardcoded values
set pluginId to "com.jmg.exportmasterplan.v11.final"
set rawJsonCriteria to "{\"type\":\"full_dump\"}"
set delaySeconds to 5

-- Escape with JSON.stringify via shell
set escapedCriteria to do shell script "python3 -c 'import json, sys, urllib.parse; criteria = \"" & quoted form of rawJsonCriteria & "\"; print(urllib.parse.quote(json.dumps(criteria)[1:-1]))'"

-- Build JS
set jsCore to "PlugIn.find('" & pluginId & "').actions[0].perform(" & escapedCriteria & ");"

set encodedOmniJs to my url_encode(jsCore)
set theURL to "omnifocus://localhost/omnijs-run?script=" & encodedOmniJs

tell application "OmniFocus"
    if not (exists front document) then
        error "Open OmniFocus first."
    end if
    GetURL theURL
end tell

delay delaySeconds

-- Get clipboard
tell application "System Events"
    set clipboardContent to the clipboard
end tell

return clipboardContent

-- Basic encode function (handles common specials)
on simple_encode(str)
    set specials to {{"%", "%25"}, {"/", "%2F"}, {"?", "%3F"}, {"=", "%3D"}, {"&", "%26"}, {" ", "%20"}, {"\n", "%0A"}}
    repeat with pair in specials
        set str to my replace(str, item 1 of pair, item 2 of pair)
    end repeat
    return str
end simple_encode

-- Replace helper
on replace(str, find, repl)
    set AppleScript's text item delimiters to find
    set ti to text items of str
    set AppleScript's text item delimiters to repl
    return ti as text
end replace
