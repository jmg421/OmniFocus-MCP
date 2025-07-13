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
	-- Plugin ID for flagged analysis (will use same plugin infrastructure)
	set pluginId to "__PLUGIN_ID__"
	set DQUOTE to character id 34 -- Double quote character for plugin ID
	set SQUOTE to character id 39 -- Single quote character for JS string
	
	-- This placeholder expects a string that is already escaped for an AppleScript string literal
	set rawJsonCriteria to "__ESCAPED_JSON_CRITERIA_FOR_APPLESCRIPT_STRING__"
	set delaySeconds to __DELAY_SECONDS__

	log "Flagged Analysis Plugin ID: " & pluginId
	log "Raw JSON Criteria for Flagged Analysis: " & rawJsonCriteria
	log "Delay: " & delaySeconds & "s"
	
	tell application "OmniFocus"
		if not (exists front document) then
			error "OmniFocus has no front document. Please open a window to run the script."
		end if
		
		-- Use the same export action but with flagged analysis criteria
		set jsCore to "PlugIn.find(" & DQUOTE & pluginId & DQUOTE & ").actions[0].perform(" & SQUOTE & rawJsonCriteria & SQUOTE & ");"
		log "Flagged Analysis JavaScript Core: " & jsCore
		
		set encodedOmniJs to my encode_text(jsCore)
		log "Encoded OmniJS for Flagged Analysis URL: " & encodedOmniJs
		
		set theURL to "omnifocus://localhost/omnijs-run?script=" & encodedOmniJs
		log "Full OmniFocus Flagged Analysis URL: " & theURL
		
		try
			-- Using GetURL as it seems to be more robust for this URL scheme
			GetURL theURL
			log "GetURL command executed for flagged analysis. The OmniJS plugin should have run."
		on error errMsgOpen number errNumOpen
			set errorMsg to "AppleScript Error during GetURL for flagged analysis: " & errMsgOpen & " (Number: " & errNumOpen & ")"
			log errorMsg
			error errorMsg
		end try
		
	end tell
	
	delay delaySeconds
	
	try
		set clipboardContent to (the clipboard as text)
		set actualLength to length of clipboardContent -- Get length once

		-- Detailed logging of what's on the clipboard
		log "Flagged Analysis AppleScript: ---- Clipboard Analysis Start ----"
		log "Flagged Analysis AppleScript: Actual clipboard content length: " & actualLength
		
		set firstChars to ""
		if actualLength > 0 then
			set firstChars to text 1 thru (my min(100, actualLength)) of clipboardContent
		end if
		log "Flagged Analysis AppleScript: First 100 chars of clipboard: " & firstChars
		
		set lastChars to ""
		if actualLength > 100 then
			set lastChars to text (actualLength - (my min(99, actualLength - 1))) thru actualLength of clipboardContent
		else if actualLength > 0 then
			set lastChars to clipboardContent
		end if
		log "Flagged Analysis AppleScript: Last 100 chars of clipboard: " & lastChars

		-- Condition checks for flagged analysis
		set isEmpty to (actualLength is 0)
		set startsWithPluginSuccessMsg to (not isEmpty and clipboardContent starts with "SUCCESS: JSON data copied to clipboard")
		set startsWithGlobalDebug to (not isEmpty and clipboardContent starts with "--- GLOBAL OBJECT DEBUG ---")
		set startsWithFlaggedDebug to (not isEmpty and clipboardContent starts with "[DEBUG_FLAGGED_V1.0]")
		
		set startsWithBrace to (not isEmpty and clipboardContent starts with "{")
		set startsWithBracket to (not isEmpty and clipboardContent starts with "[")
		set endsWithBrace to (not isEmpty and clipboardContent ends with "}")
		set endsWithBracket to (not isEmpty and clipboardContent ends with "]")

		log "Flagged Analysis AppleScript: Validation Checks:"
		log "Flagged Analysis AppleScript: Is Empty? " & isEmpty
		log "Flagged Analysis AppleScript: Starts with Plugin Success Msg? " & startsWithPluginSuccessMsg
		log "Flagged Analysis AppleScript: Starts with Global Debug Msg? " & startsWithGlobalDebug
		log "Flagged Analysis AppleScript: Starts with Flagged Debug Msg? " & startsWithFlaggedDebug
		log "Flagged Analysis AppleScript: Starts with '{'? " & startsWithBrace
		log "Flagged Analysis AppleScript: Starts with '['? " & startsWithBracket
		log "Flagged Analysis AppleScript: Ends with '}'? " & endsWithBrace
		log "Flagged Analysis AppleScript: Ends with ']'? " & endsWithBracket
		log "Flagged Analysis AppleScript: ---- Clipboard Analysis End ----"

		if isEmpty then
			log "Flagged Analysis AppleScript Error: Clipboard is empty."
			error "AppleScript Error: Clipboard was empty after flagged analysis plugin execution. Plugin might have failed."
		else if startsWithPluginSuccessMsg then
			log "Flagged Analysis AppleScript Error: Clipboard contains plugin success message."
			error "AppleScript Error: Clipboard contained plugin success message instead of flagged analysis JSON data. Content snippet: " & firstChars
		else if startsWithGlobalDebug then
			log "Flagged Analysis AppleScript Error: Clipboard contains OmniJS Global Object Debug Output."
			error "AppleScript Error: Clipboard contained debug output instead of flagged analysis data. Content snippet: " & firstChars
		else if not ((startsWithBrace and endsWithBrace) or (startsWithBracket and endsWithBracket)) then
			set errorDetail to "Flagged analysis validation failed: "
			if not startsWithBrace and not startsWithBracket then set errorDetail to errorDetail & "Doesn't start with { or [. "
			if not endsWithBrace and not endsWithBracket then set errorDetail to errorDetail & "Doesn't end with } or ]. "
			if startsWithBrace and not endsWithBrace then set errorDetail to errorDetail & "Starts with { but doesn't end with }. "
			if startsWithBracket and not endsWithBracket then set errorDetail to errorDetail & "Starts with [ but doesn't end with ]. "
			
			log "Flagged Analysis AppleScript Error: JSON structure validation failed. " & errorDetail
			error "AppleScript Error: Flagged analysis clipboard content does not appear to be valid JSON. " & errorDetail & "Length: " & actualLength & ". Snippet: " & firstChars
		else
			log "Flagged Analysis AppleScript: Clipboard content appears to be valid flagged analysis JSON and will be returned."
			return clipboardContent
		end if
		
	on error errMsgClipboard number errNumClipboard
		set errorMsgClipboardRead to "Flagged Analysis AppleScript Clipboard Error: " & errMsgClipboard & " (Error Code: " & errNumClipboard & ")"
		log errorMsgClipboardRead
		error errorMsgClipboardRead
	end try
	
on error errorMessage number errorNumber
	set finalErrorMsg to "Overall Flagged Analysis AppleScript Error (Number: " & errorNumber & "): " & errorMessage
	log finalErrorMsg
	error finalErrorMsg
end try 