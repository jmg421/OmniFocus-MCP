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
    } catch (e) {
        // argument is not a valid JSON string, treat as a simple string
    }

    const db = app.defaultDocument;
    const result = {
        version: "1.0",
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

    if (criteria.type === 'next_actions') {
        result.tasks = db.availableTasks.map(taskToJSON);
    } else { // full_dump
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