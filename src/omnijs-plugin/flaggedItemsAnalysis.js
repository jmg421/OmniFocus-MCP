/*
OmniJS Plugin: Flagged Items Analysis
Provides detailed analysis of flagged items to help with systematic cleanup
*/
const run = (argument) => {
    // --- UTILITY FUNCTIONS ---
    const getTaskStatus = (task) => {
        // Debug info for troubleshooting
        const debug = {
            completed: task.completed,
            taskStatus: task.taskStatus,
            taskStatusType: typeof task.taskStatus,
            taskStatusString: String(task.taskStatus)
        };
        
        if (task.completed) return 'Completed';
        switch (task.taskStatus) {
            case Task.Status.Active: return 'Active';
            case Task.Status.Completed: return 'Completed';
            case Task.Status.Dropped: return 'Dropped';
            case Task.Status.DueSoon: return 'DueSoon';
            case Task.Status.Flagged: return 'Flagged';
            case Task.Status.Next: return 'Next';
            case Task.Status.Overdue: return 'Overdue';
            case Task.Status.Blocked: return 'Blocked';
            case Task.Status.Available: return 'Available';
            default: return `Unknown(completed:${task.completed},taskStatus:${String(task.taskStatus)})`;
        }
    };

    const taskToJSON = (task) => {
        const proj = task.containingProject;
        const parent = task.parent;
        return {
            id: task.id.primaryKey,
            name: task.name,
            note: task.note,
            status: getTaskStatus(task),
            taskStatus: getTaskStatus(task), // Fixed: use getTaskStatus instead of task.taskStatus.name
            flagged: task.flagged,
            completed: task.completed,
            dueDate: task.dueDate,
            deferDate: task.deferDate,
            completionDate: task.completionDate,
            estimatedMinutes: task.estimatedMinutes,
            projectId: proj ? proj.id.primaryKey : null,
            projectName: proj ? proj.name : 'Inbox',
            parentId: parent ? parent.id.primaryKey : null,
            childIds: task.tasks.map(t => t.id.primaryKey),
            tagIds: task.tags.map(t => t.id.primaryKey),
            tagNames: task.tags.map(t => t.name),
            // Analysis fields
            isOverdue: task.dueDate && task.dueDate < new Date() && !task.completed,
            isDueToday: task.dueDate && task.dueDate.toDateString() === new Date().toDateString(),
            hasDueDate: !!task.dueDate,
            hasChildren: task.tasks.length > 0,
            isActionable: task.taskStatus === Task.Status.Available || task.taskStatus === Task.Status.Next,
        };
    };

    const projectToJSON = (project) => ({
        id: project.id.primaryKey,
        name: project.name,
        status: project.status.name,
        flagged: project.flagged,
        note: project.note,
        dueDate: project.dueDate,
        deferDate: project.deferDate,
        completionDate: project.completionDate,
        estimatedMinutes: project.estimatedMinutes,
        taskCount: project.rootTask.tasks.length,
        flaggedTaskCount: project.rootTask.tasks.filter(t => t.flagged).length,
    });

    // --- MAIN LOGIC ---
    let criteria = {};
    try {
        criteria = JSON.parse(argument);
    } catch (e) {
        // argument is not a valid JSON string, treat as simple string
    }

    const db = app.defaultDocument;
    const now = new Date();
    
    // COMPREHENSIVE FLAGGED TASK COLLECTION - ensuring 100% data consistency
    const allTasks = [];
    const taskIds = new Set(); // Prevent duplicates
    let debugCounts = {
        inbox: 0,
        projectFlattened: 0,
        dbFlattened: 0,
        dbAll: 0,
        libraryAll: 0
    };
    
    console.log(`[DEBUG_FLAGGED_V1.0] Starting comprehensive flagged task collection...`);
    
    // Method 1: Inbox tasks (both active and completed)
    console.log(`[DEBUG_FLAGGED_V1.0] Method 1: Checking inbox tasks...`);
    db.inbox.tasks.forEach(task => {
        if (task.flagged && !taskIds.has(task.id.primaryKey)) {
            allTasks.push(task);
            taskIds.add(task.id.primaryKey);
            debugCounts.inbox++;
        }
    });
    console.log(`[DEBUG_FLAGGED_V1.0] Found ${debugCounts.inbox} flagged inbox tasks`);
    
    // Method 2: Project flattened tasks (all tasks in all projects)
    console.log(`[DEBUG_FLAGGED_V1.0] Method 2: Checking all project flattenedTasks...`);
    db.projects.forEach(project => {
        project.flattenedTasks.forEach(task => {
            if (task.flagged && !taskIds.has(task.id.primaryKey)) {
                allTasks.push(task);
                taskIds.add(task.id.primaryKey);
                debugCounts.projectFlattened++;
            }
        });
    });
    console.log(`[DEBUG_FLAGGED_V1.0] Found ${debugCounts.projectFlattened} additional flagged project tasks`);
    
    // Method 3: Database flattenedTasks (comprehensive sweep)
    console.log(`[DEBUG_FLAGGED_V1.0] Method 3: Checking db.flattenedTasks...`);
    try {
        db.flattenedTasks.forEach(task => {
            if (task.flagged && !taskIds.has(task.id.primaryKey)) {
                allTasks.push(task);
                taskIds.add(task.id.primaryKey);
                debugCounts.dbFlattened++;
            }
        });
        console.log(`[DEBUG_FLAGGED_V1.0] Found ${debugCounts.dbFlattened} additional flagged tasks from db.flattenedTasks`);
    } catch (e) {
        console.log(`[DEBUG_FLAGGED_V1.0] db.flattenedTasks failed: ${e.message}`);
    }
    
    // Method 4: ALL tasks in database (including completed)
    console.log(`[DEBUG_FLAGGED_V1.0] Method 4: Checking db.allTasks (if available)...`);
    try {
        if (db.allTasks) {
            db.allTasks.forEach(task => {
                if (task.flagged && !taskIds.has(task.id.primaryKey)) {
                    allTasks.push(task);
                    taskIds.add(task.id.primaryKey);
                    debugCounts.dbAll++;
                }
            });
            console.log(`[DEBUG_FLAGGED_V1.0] Found ${debugCounts.dbAll} additional flagged tasks from db.allTasks`);
        } else {
            console.log(`[DEBUG_FLAGGED_V1.0] db.allTasks not available`);
        }
    } catch (e) {
        console.log(`[DEBUG_FLAGGED_V1.0] db.allTasks failed: ${e.message}`);
    }
    
    // Method 5: Library-level search (most comprehensive)
    console.log(`[DEBUG_FLAGGED_V1.0] Method 5: Checking library-level collections...`);
    try {
        // Try different collection approaches
        const library = app.defaultDocument.library || app.defaultDocument;
        if (library && library.flattenedTasks) {
            library.flattenedTasks.forEach(task => {
                if (task.flagged && !taskIds.has(task.id.primaryKey)) {
                    allTasks.push(task);
                    taskIds.add(task.id.primaryKey);
                    debugCounts.libraryAll++;
                }
            });
            console.log(`[DEBUG_FLAGGED_V1.0] Found ${debugCounts.libraryAll} additional flagged tasks from library`);
        }
    } catch (e) {
        console.log(`[DEBUG_FLAGGED_V1.0] Library search failed: ${e.message}`);
    }
    
    console.log(`[DEBUG_FLAGGED_V1.0] COLLECTION SUMMARY:`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Inbox: ${debugCounts.inbox}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Project Flattened: ${debugCounts.projectFlattened}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - DB Flattened: ${debugCounts.dbFlattened}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - DB All Tasks: ${debugCounts.dbAll}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Library: ${debugCounts.libraryAll}`);
    console.log(`[DEBUG_FLAGGED_V1.0] TOTAL UNIQUE FLAGGED TASKS: ${allTasks.length}`);

    // Get flagged projects
    const flaggedProjects = db.projects.filter(project => project.flagged);
    console.log(`[DEBUG_FLAGGED_V1.0] Found ${flaggedProjects.length} flagged projects`);

    // Convert to JSON with analysis
    const flaggedTasks = allTasks.map(taskToJSON);
    const flaggedProjectsData = flaggedProjects.map(projectToJSON);

    // COMPREHENSIVE ANALYSIS - Data Consistency Check
    const statusBreakdown = {
        completed: flaggedTasks.filter(t => t.completed).length,
        active: flaggedTasks.filter(t => !t.completed).length,
        overdue: flaggedTasks.filter(t => t.isOverdue).length,
        dueToday: flaggedTasks.filter(t => t.isDueToday).length,
        withDueDates: flaggedTasks.filter(t => t.hasDueDate).length,
        withChildren: flaggedTasks.filter(t => t.hasChildren).length,
        actionable: flaggedTasks.filter(t => t.isActionable).length
    };
    
    console.log(`[DEBUG_FLAGGED_V1.0] STATUS BREAKDOWN:`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Completed: ${statusBreakdown.completed}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Active: ${statusBreakdown.active}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Overdue: ${statusBreakdown.overdue}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Due Today: ${statusBreakdown.dueToday}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - With Due Dates: ${statusBreakdown.withDueDates}`);
    console.log(`[DEBUG_FLAGGED_V1.0] - Actionable: ${statusBreakdown.actionable}`);

    // Categorize flagged items for analysis
    const categories = {
        actionableNextActions: flaggedTasks.filter(t => t.isActionable && !t.hasChildren),
        overdueItems: flaggedTasks.filter(t => t.isOverdue),
        dueTodayItems: flaggedTasks.filter(t => t.isDueToday),
        completedItems: flaggedTasks.filter(t => t.completed),
        referenceCategories: flaggedTasks.filter(t => 
            t.name.toLowerCase().includes('process') ||
            t.name.toLowerCase().includes('measures') ||
            t.name.toLowerCase().includes('coordination') ||
            t.name.toLowerCase().includes('advocacy') ||
            t.hasChildren
        ),
        westonHealingItems: flaggedTasks.filter(t => 
            t.projectName && t.projectName.toLowerCase().includes('weston healing')
        ),
        projectManagement: flaggedTasks.filter(t =>
            t.name.toLowerCase().includes('review') ||
            t.name.toLowerCase().includes('plan') ||
            t.name.toLowerCase().includes('organize')
        ),
        inboxItems: flaggedTasks.filter(t => t.projectName === 'Inbox'),
    };

    // Enhanced result structure for data consistency
    const result = {
        version: "flagged-analysis-2.0",
        timestamp: now.toISOString(),
        dataConsistency: {
            totalTasksFound: allTasks.length,
            collectionBreakdown: debugCounts,
            statusBreakdown: statusBreakdown,
            expectedVsActual: {
                note: "Compare totalTasksFound with your OmniFocus flagged count for validation"
            }
        },
        summary: {
            totalFlaggedTasks: flaggedTasks.length,
            totalFlaggedProjects: flaggedProjectsData.length,
            completedFlaggedTasks: statusBreakdown.completed,
            activeFlaggedTasks: statusBreakdown.active,
            actionableNextActions: categories.actionableNextActions.length,
            overdueItems: categories.overdueItems.length,
            dueTodayItems: categories.dueTodayItems.length,
            referenceCategories: categories.referenceCategories.length,
            westonHealingItems: categories.westonHealingItems.length,
            inboxItems: categories.inboxItems.length,
        },
        flaggedTasks: flaggedTasks,
        flaggedProjects: flaggedProjectsData,
        categories: categories,
        recommendations: {
            shouldUnflagReferenceCategories: categories.referenceCategories.length > 0,
            shouldProcessInboxItems: categories.inboxItems.length > 0,
            shouldAddresOverdueItems: categories.overdueItems.length > 0,
            shouldFocusOnActionableItems: categories.actionableNextActions.length > 0,
            shouldReviewCompletedFlags: categories.completedItems.length > 0,
        }
    };

    // Copy to clipboard
    const clipboardData = JSON.stringify(result, null, 2);
    const clipboardLength = clipboardData.length;
    
    if (clipboardLength > 0) {
        console.log(`[DEBUG_FLAGGED_V1.0] Flagged analysis complete. Tasks: ${flaggedTasks.length}, Projects: ${flaggedProjectsData.length}. JSON length: ${clipboardLength}`);
        console.log(`[DEBUG_FLAGGED_V1.0] SUCCESS: Flagged analysis data copied to clipboard. Tasks: ${flaggedTasks.length}. JSON length: ${clipboardLength}`);
        return clipboardData;
    } else {
        console.log(`[DEBUG_FLAGGED_V1.0] ERROR: Empty clipboard data generated`);
        return JSON.stringify({ error: "No flagged items analysis data generated" });
    }
};

run; 