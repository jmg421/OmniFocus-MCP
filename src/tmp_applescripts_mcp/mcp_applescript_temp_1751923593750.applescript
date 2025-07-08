on encode_text(theText)
	set oldDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to ""
	set theChars to characters of theText
	set theResult to ""
	set HCHARS to "0123456789ABCDEF" -- Hex characters for percent encoding
	repeat with aChar in theChars
		set cID to id of aChar
		if (cID ≥ 48 and cID ≤ 57) or ¬
			(cID ≥ 65 and cID ≤ 90) or ¬
			(cID ≥ 97 and cID ≤ 122) or ¬
			cID = 45 or cID = 46 or cID = 95 or cID = 126 then -- Unreserved character
			set theResult to theResult & aChar as string
		else
			set H to (cID div 16) + 1
			set L to (cID mod 16) + 1
			set theResult to theResult & "%" & (character H of HCHARS) & (character L of HCHARS)
		end if
	end repeat
	set AppleScript's text item delimiters to oldDelimiters
	return theResult
end encode_text

on min(a, b)
	if a < b then
		return a
	else
		return b
	end if
end min

try
	-- Placeholders will be replaced by the TypeScript code
	set pluginId to "com.jmg.exportmasterplan.v11.final"
	set DQUOTE to character id 34 -- Double quote character for plugin ID
	set SQUOTE to character id 39 -- Single quote character for JS string
	
	-- This placeholder expects a string that is already escaped for an AppleScript string literal
	-- e.g., "{\"type\":\"next_actions\",\"hideCompleted\":true}"
	set rawJsonCriteria to "{\"type\":\"full_dump\",\"hideCompleted\":false}"
	set delaySeconds to 20

	log "Plugin ID: " & pluginId
	log "Raw JSON Criteria for OmniJS: " & rawJsonCriteria
	log "Delay: " & delaySeconds & "s"
	
	tell application "OmniFocus"
		if not (exists front document) then
			error "OmniFocus has no front document. Please open a window to run the script."
		end if
		
		set jsCore to "PlugIn.find(" & DQUOTE & pluginId & DQUOTE & ").actions[0].perform(" & SQUOTE & rawJsonCriteria & SQUOTE & ");"
		log "JavaScript Core to be executed: " & jsCore
		
		set encodedOmniJs to my encode_text(jsCore)
		log "Encoded OmniJS for URL: " & encodedOmniJs
		
		set theURL to "omnifocus://localhost/omnijs-run?script=" & encodedOmniJs
		log "Full OmniFocus URL: " & theURL
		
		try
			-- Using GetURL as it seems to be more robust for this URL scheme
			GetURL theURL
			log "GetURL command executed. The OmniJS plugin should have run."
		on error errMsgOpen number errNumOpen
			set errorMsg to "AppleScript Error during GetURL: " & errMsgOpen & " (Number: " & errNumOpen & ")"
			log errorMsg
			error errorMsg
		end try
		
	end tell
	
	delay delaySeconds
	
	try
		set clipboardContent to (the clipboard as text)
		set actualLength to length of clipboardContent -- Get length once

		-- Detailed logging of what's on the clipboard
		log "AppleScript: ---- Clipboard Analysis Start ----"
		log "AppleScript: Actual clipboard content length: " & actualLength
		
		set firstChars to ""
		if actualLength > 0 then
			set firstChars to text 1 thru (my min(100, actualLength)) of clipboardContent
		end if
		log "AppleScript: First 100 chars of clipboard: " & firstChars
		
		set lastChars to ""
		if actualLength > 100 then
			set lastChars to text (actualLength - (my min(99, actualLength - 1))) thru actualLength of clipboardContent
		else if actualLength > 0 then
			set lastChars to clipboardContent
		end if
		log "AppleScript: Last 100 chars of clipboard: " & lastChars

		-- Condition checks
		set isEmpty to (actualLength is 0)
		set startsWithPluginSuccessMsg to (not isEmpty and clipboardContent starts with "SUCCESS: JSON data copied to clipboard")
		set startsWithGlobalDebug to (not isEmpty and clipboardContent starts with "--- GLOBAL OBJECT DEBUG ---")
		
		set startsWithBrace to (not isEmpty and clipboardContent starts with "{")
		set startsWithBracket to (not isEmpty and clipboardContent starts with "[")
		set endsWithBrace to (not isEmpty and clipboardContent ends with "}")
		set endsWithBracket to (not isEmpty and clipboardContent ends with "]")

		log "AppleScript: Validation Checks:"
		log "AppleScript: Is Empty? " & isEmpty
		log "AppleScript: Starts with Plugin Success Msg? " & startsWithPluginSuccessMsg
		log "AppleScript: Starts with Global Debug Msg? " & startsWithGlobalDebug
		log "AppleScript: Starts with '{'? " & startsWithBrace
		log "AppleScript: Starts with '['? " & startsWithBracket
		log "AppleScript: Ends with '}'? " & endsWithBrace
		log "AppleScript: Ends with ']'? " & endsWithBracket
		log "AppleScript: ---- Clipboard Analysis End ----"

		if isEmpty then
			log "AppleScript Error Condition: Clipboard is empty."
			error "AppleScript Error: Clipboard was empty after plugin execution and delay. Plugin might have failed to copy, data might be too large/slow for clipboard, or another issue occurred."
		else if startsWithPluginSuccessMsg then
			log "AppleScript Error Condition: Clipboard contains plugin success message."
			error "AppleScript Error: Clipboard contained plugin success message, not JSON data. Content snippet: " & firstChars
		else if startsWithGlobalDebug then
			log "AppleScript Error Condition: Clipboard contains OmniJS Global Object Debug Output."
			error "AppleScript Error: Clipboard contained OmniJS Global Object Debug Output. Content snippet: " & firstChars
		else if not ((startsWithBrace and endsWithBrace) or (startsWithBracket and endsWithBracket)) then
			set errorDetail to "Validation failed: "
			if not startsWithBrace and not startsWithBracket then set errorDetail to errorDetail & "Doesn't start with { or [. "
			if not endsWithBrace and not endsWithBracket then set errorDetail to errorDetail & "Doesn't end with } or ]. "
			if startsWithBrace and not endsWithBrace then set errorDetail to errorDetail & "Starts with { but doesn't end with }. "
			if startsWithBracket and not endsWithBracket then set errorDetail to errorDetail & "Starts with [ but doesn't end with ]. "
			
			log "AppleScript Error Condition: JSON structure validation failed. " & errorDetail
			error "AppleScript Error: Clipboard content does not appear to be valid JSON. " & errorDetail & "Length: " & actualLength & ". Snippet: " & firstChars
		else
			log "AppleScript: Clipboard content appears to be valid JSON and will be returned."
			return clipboardContent
		end if
		
	on error errMsgClipboard number errNumClipboard
		set errorMsgClipboardRead to "AppleScript Clipboard Error Handler: " & errMsgClipboard & " (Error Code: " & errNumClipboard & ")"
		log errorMsgClipboardRead
		error errorMsgClipboardRead
	end try
	
on error errorMessage number errorNumber
	set finalErrorMsg to "Overall AppleScript Error (Number: " & errorNumber & "): " & errorMessage
	log finalErrorMsg
	error finalErrorMsg
end try 