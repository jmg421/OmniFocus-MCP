/*
This script is designed to be wrapped into an OmniJS plugin.
It provides the core logic for dumping the OmniFocus database.
*/
const run = (argument) => {
    // --- UTILITY FUNCTIONS ---
    const getTaskStatus = (task) => {
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
            default: return 'Unknown';
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
            taskStatus: task.taskStatus.name,
            flagged: task.flagged,
            completed: task.completed,
            dueDate: task.dueDate,
            deferDate: task.deferDate,
            completionDate: task.completionDate,
            estimatedMinutes: task.estimatedMinutes,
            projectId: proj ? proj.id.primaryKey : null,
            parentId: parent ? parent.id.primaryKey : null,
            childIds: task.tasks.map(t => t.id.primaryKey),
            tagIds: task.tags.map(t => t.id.primaryKey),
        };
    };

    const projectToJSON = (project) => ({
        id: project.id.primaryKey,
        name: project.name,
        status: project.status.name,
        tasks: project.rootTask.tasks.map(taskToJSON),
    });

    const folderToJSON = (folder) => ({
        id: folder.id.primaryKey,
        name: folder.name,
        parentFolderID: folder.parentFolder ? folder.parentFolder.id.primaryKey : null,
    });

    // --- MAIN LOGIC ---
    let criteria = {};
    try {
        criteria = JSON.parse(argument);
        console.log(`[DEBUG_EXPORT_V1.0] Parsed criteria successfully:`, JSON.stringify(criteria));
    } catch (e) {
        // argument is not a valid JSON string, treat as a simple string
        console.log(`[DEBUG_EXPORT_V1.0] Failed to parse argument as JSON: "${argument}". Error: ${e.message}`);
    }

    const db = app.defaultDocument;
    const result = {
        version: criteria.type === 'flagged_analysis' ? "flagged-analysis-1.0" : (criteria.type === 'next_actions' ? "next-actions-1.0" : "1.0"),
        timestamp: new Date().toISOString(),
        tasks: [],
        projects: {},
        folders: {},
        tags: {},
        inboxTasks: [],
    };

    // Process all tags
    db.tags.forEach(tag => {
        result.tags[tag.id.primaryKey] = { id: tag.id.primaryKey, name: tag.name };
    });

    console.log(`[DEBUG_EXPORT_V1.0] Criteria type: "${criteria.type}"`);
    
    if (criteria.type === 'next_actions') {
        console.log(`[DEBUG_EXPORT_V1.0] Taking next_actions branch`);
        result.tasks = db.availableTasks.map(taskToJSON);
    } else if (criteria.type === 'flagged_analysis') {
        console.log(`[DEBUG_EXPORT_V1.0] Taking flagged_analysis branch`);
        // FLAGGED ITEMS ANALYSIS
        // FLAGGED ITEMS ANALYSIS
        const now = new Date();
        
        // Get all flagged tasks (both inbox and project tasks)
        const allFlaggedTasks = [];
        
        // Add inbox flagged tasks
        db.inbox.tasks.forEach(task => {
            if (task.flagged) allFlaggedTasks.push(task);
        });
        
        // Add project flagged tasks
        db.projects.forEach(project => {
            project.flattenedTasks.forEach(task => {
                if (task.flagged) allFlaggedTasks.push(task);
            });
        });

        // Get flagged projects
        const flaggedProjects = db.projects.filter(project => project.flagged);

        // Enhanced task conversion with analysis fields
        const taskToAnalysisJSON = (task) => {
            const proj = task.containingProject;
            const parent = task.parent;
            return {
                id: task.id.primaryKey,
                name: task.name,
                note: task.note,
                status: getTaskStatus(task),
                taskStatus: task.taskStatus.name,
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
                isOverdue: task.dueDate && task.dueDate < now && !task.completed,
                isDueToday: task.dueDate && task.dueDate.toDateString() === now.toDateString(),
                hasDueDate: !!task.dueDate,
                hasChildren: task.tasks.length > 0,
                isActionable: task.taskStatus === Task.Status.Available || task.taskStatus === Task.Status.Next,
            };
        };

        const projectAnalysisJSON = (project) => ({
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

        // Convert to JSON with analysis
        const flaggedTasks = allFlaggedTasks.map(taskToAnalysisJSON);
        const flaggedProjectsData = flaggedProjects.map(projectAnalysisJSON);

        // Categorize flagged items for analysis
        const categories = {
            actionableNextActions: flaggedTasks.filter(t => t.isActionable && !t.hasChildren),
            overdueItems: flaggedTasks.filter(t => t.isOverdue),
            dueTodayItems: flaggedTasks.filter(t => t.isDueToday),
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

        // Override result structure for flagged analysis
        result = {
            version: "flagged-analysis-1.0",
            timestamp: now.toISOString(),
            summary: {
                totalFlaggedTasks: flaggedTasks.length,
                totalFlaggedProjects: flaggedProjectsData.length,
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
            }
        };
    } else { // full_dump
        console.log(`[DEBUG_EXPORT_V1.0] Taking full_dump branch (default)`);
        // Process all folders
        db.folders.forEach(folder => {
            result.folders[folder.id.primaryKey] = folderToJSON(folder);
        });
        // Process all projects
        db.projects.forEach(project => {
            result.projects[project.id.primaryKey] = projectToJSON(project);
        });
        // Process inbox tasks
        result.inboxTasks = db.inbox.tasks.map(taskToJSON);
    }

    return JSON.stringify(result, null, 2);
};

run; 