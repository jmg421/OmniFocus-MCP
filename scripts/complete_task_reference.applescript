-- complete_task_reference.applescript
-- Completes a task by its ID, handling subtasks and inbox tasks.

on run {input_task_id} -- Expecting task_id as a string argument
	if input_task_id is "" or input_task_id is missing value then
		log "AppleScript Error: Task ID was empty or missing."
		error "Task ID cannot be empty."
	end if

	set task_id to input_task_id
	log "AppleScript: Attempting to complete task ID: " & task_id

	tell application "OmniFocus"
		try
			set theDocument to default document -- Get a firm reference

			tell theDocument
				-- Try to get the task. This is where "Invalid Index" might occur.
				-- Using a broader search initially to see if we can find it at all by ID.
				set foundTasks to (every flattened task whose id is task_id)
				
				if (count of foundTasks) is 0 then
					log "AppleScript Error: Task with ID '" & task_id & "' not found using 'every flattened task whose id is ...'."
					return "Error: Task ID " & task_id & " not found."
				else if (count of foundTasks) > 1 then
					-- This shouldn't happen if IDs are unique, but good to log.
					log "AppleScript Warning: Multiple tasks found with ID '" & task_id & "'. Using the first one."
				end if
				
				set theTask to item 1 of foundTasks
				log "AppleScript: Found task: " & (name of theTask) & " (ID: " & (id of theTask) & ")"

				-- Function to process a task (complete it, handling inbox and subtasks)
				script TaskProcessor
					on processTask(taskToProcess, containingDocument)
						tell theDocument
							set taskNameForLog to missing value
							try
								set taskNameForLog to name of taskToProcess
							on error
								set taskNameForLog to "[Error getting name]"
							end try
							log "TaskProcessor: Processing task: " & taskNameForLog & " (ID: " & (id of taskToProcess) & ")"

							-- Determine inbox status
							set isInInbox to true 
							try
								if containing project of taskToProcess is not missing value then
									set isInInbox to false 
								end if
							on error errMsgInboxCheck
								log "TaskProcessor: Error checking 'containing project' for task ID " & (id of taskToProcess) & ": " & errMsgInboxCheck
								error "Failed to determine inbox status for task ID " & (id of taskToProcess) & ". Error: " & errMsgInboxCheck
							end try
							log "TaskProcessor: Task ID " & (id of taskToProcess) & ". Is in inbox? " & isInInbox

							if isInInbox then
								log "TaskProcessor: Task ID " & (id of taskToProcess) & " is in Inbox. Attempting to move to 'Reference' project."
								set refProject to missing value
								try
									set refProject to first flattened project whose name is "Reference"
									log "TaskProcessor: 'Reference' project found."
								on error
									log "TaskProcessor: 'Reference' project not found. Creating it."
									set refProject to make new project with properties {name:"Reference"}
									log "TaskProcessor: 'Reference' project created."
								end try
								
								try
									move taskToProcess to end of tasks of refProject
									log "TaskProcessor: Task ID " & (id of taskToProcess) & " moved to 'Reference' project successfully."
									delay 0.2 

									-- Re-fetch the task from its new location
									set taskToActuallyComplete to (first flattened task of refProject whose id is (id of taskToProcess))
									log "TaskProcessor: Re-fetched task ID " & (id of taskToActuallyComplete) & " from Reference project."

									if completed of taskToActuallyComplete is false then
										mark complete taskToActuallyComplete
										log "TaskProcessor: Task ID " & (id of taskToActuallyComplete) & " (post-move) marked as completed."
									else
										log "TaskProcessor: Task ID " & (id of taskToActuallyComplete) & " (post-move) was already completed."
									end if
								on error errMsgMoveOrComplete
									log "TaskProcessor: Task ID " & (id of taskToProcess) & ": " & errMsgMoveOrComplete
									error "Failed to process inbox task ID " & (id of taskToProcess) & ". Error: " & errMsgMoveOrComplete
								end try
							else -- Task was not in inbox (or already handled if it was)
								log "TaskProcessor: Task ID " & (id of taskToProcess) & " is not in inbox. Re-fetching and activating before direct completion."
								activate -- Bring OmniFocus to front
								delay 0.1 -- Small delay for activation
								set freshTaskReference to missing value
								try
									-- Re-fetch the task by its ID from the main document to ensure a fresh reference
									set freshTaskReference to (first flattened task whose id is (id of taskToProcess))
									if freshTaskReference is missing value then
										error "Could not re-fetch task ID " & (id of taskToProcess) & " before direct completion."
									end if
									log "TaskProcessor: Re-fetched task ID " & (id of freshTaskReference) & " as freshTaskReference."
									
									if completed of freshTaskReference is false then
										mark complete freshTaskReference
										log "TaskProcessor: Task ID " & (id of freshTaskReference) & " (freshly fetched) marked as completed."
									else
										log "TaskProcessor: Task ID " & (id of freshTaskReference) & " (freshly fetched) was already completed."
									end if
								on error errMsgComplete
									log "TaskProcessor: Error setting non-inbox task ID " & (id of taskToProcess) & " (using fresh ref) as completed: " & errMsgComplete
									error "Failed to set task completed for ID " & (id of taskToProcess) & " (using fresh ref). Error: " & errMsgComplete
								end try
							end if
						end tell
					end processTask
				end script
				
				-- Process the main task and all its subtasks
				-- Check if theTask is valid before proceeding
				if theTask is not missing value then
					log "AppleScript: Task '" & (name of theTask) & "' is valid. Processing its subtasks (if any)."
					-- First process any subtasks recursively
					set subTasksToProcess to every task of theTask
					if (count of subTasksToProcess) > 0 then
						log "AppleScript: Found " & (count of subTasksToProcess) & " subtask(s)."
						repeat with subTask in subTasksToProcess
							log "AppleScript: Processing subtask: " & (name of subTask)
							TaskProcessor's processTask(subTask, theDocument)
						end repeat
						log "AppleScript: Finished processing subtasks."
					else
						log "AppleScript: No subtasks to process."
					end if
					
					-- Then process the main task
					log "AppleScript: Processing main task: " & (name of theTask)
					TaskProcessor's processTask(theTask, theDocument)
					log "AppleScript: Main task processed."
					
					return "Success: Task ID " & task_id & " and its subtasks marked complete."
				else
					-- This case should ideally be caught by the initial 'count of foundTasks' check
					log "AppleScript Error: theTask variable became invalid before processing."
					return "Error: Task ID " & task_id & " became invalid before processing."
				end if
			end tell
		on error errMsg number errNum
			set errorDetails to "AppleScript Runtime Error completing task ID " & task_id & ": " & errMsg & " (Number: " & errNum & ")"
			log errorDetails
			return "Error: " & errorDetails
		end try
	end tell
end run 