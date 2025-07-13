--------------------------------------------------------------------------------
-- OmniFocus → Export Master Plan → silent JSON dump to file
-- 1. Fires the plugin with {"type":"full_dump"} and copies the JSON to clipboard
-- 2. Waits a configurable delay
-- 3. Writes the clipboard contents to ~/Desktop/omnifocus-export-<timestamp>.json
--
-- Author: JMG (generated via AI assistant)
--------------------------------------------------------------------------------

property pluginId : "com.jmg.exportmasterplan" -- OmniJS plugin identifier
property exportCriteria : "{\"type\":\"full_dump\"}" -- Change to {"type":"next_actions"} if desired
property waitSeconds : 8 -- Increase if your database is very large

on run
    -- Remember which application was frontmost so we can restore focus later
    tell application "System Events" to set frontAppName to name of first application process whose frontmost is true
    -- Build the OmniJS that calls the plugin action directly with (selection, sender, argument)
    -- We supply a minimal selection object providing the database, no sender, and our criteria as the argument.
    set jsCall to "var plugin = PlugIn.find('" & pluginId & "'); var act = plugin.actions[0]; act.perform({database: Database.current}, null, '" & exportCriteria & "');"
    set encodedJS to my urlEncode(jsCall)
    set omniURL to "omnifocus://localhost/omnijs-run?script=" & encodedJS

    -- Fire the plugin (OmniFocus will briefly come to the front)
    tell application "OmniFocus"
        activate
        if not (exists front document) then error "OmniFocus has no open window."
        open location omniURL
    end tell

    -- Wait for the plugin to finish copying JSON
    delay waitSeconds

    -- Grab clipboard contents
    set jsonData to the clipboard as text
    if jsonData does not start with "{" then error "Clipboard does not appear to contain JSON."

    -- Construct output path
    set timeStamp to do shell script "date +%Y-%m-%dT%H%M%S"
    set outPath to POSIX path of (path to desktop) & "omnifocus-export-" & timeStamp & ".json"

    -- Write the file
    do shell script "printf %s " & quoted form of jsonData & " > " & quoted form of outPath

    -- Restore previously frontmost application, if different
    if frontAppName is not "OmniFocus" then
        tell application frontAppName to activate
    end if

    return outPath
end run

-- URL-encode helper (minimal, handles ASCII)
on urlEncode(theText)
    set charList to characters of theText
    set hexChars to "0123456789ABCDEF"
    set encoded to ""
    repeat with c in charList
        set n to id of c
        if (n ≥ 48 and n ≤ 57) or (n ≥ 65 and n ≤ 90) or (n ≥ 97 and n ≤ 122) or n = 45 or n = 46 or n = 95 or n = 126 then
            set encoded to encoded & c
        else
            set encoded to encoded & "%" & character ((n div 16) + 1) of hexChars & character ((n mod 16) + 1) of hexChars
        end if
    end repeat
    return encoded
end urlEncode 