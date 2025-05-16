    try
        log "AppleScript is running"
        set a to 1 + 1
        return "Minimal script executed"
    on error errMsgOuter number errNumOuter
        return "AppleScript Error: Outer error handler was reached."
    end try
