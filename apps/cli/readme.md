# CLI

A terminal-based CLI tool built with React (Ink) for managing development workflows, tracking code changes, and orchestrating development processes. The tool provides a structured way to manage environments, workspaces, processes (agents/terminals), and track changes with file diffs and agent summaries.

## Features

- **Environment Management** - Organize development environments
- **Workspace Management** - Manage local and cloud workspaces
- **Process Orchestration** - Track agents and terminal processes
- **Change Tracking** - Record code changes with file diffs
- **Persistent Storage** - JSON-based storage using Lowdb (stored at `~/.superset/cli/db.json`)

## Development

To run this, have 2 processes:

The first one is the build process:
```
bun dev
```

The 2nd one runs the actual dev "server"
```
bun start
```