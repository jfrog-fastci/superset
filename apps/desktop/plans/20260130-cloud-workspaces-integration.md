# Cloud Workspaces Integration Plan

## Status: Sprint 1 Complete

## Completed

### Infrastructure
- [x] Control Plane (Cloudflare Workers) - Deployed to `https://superset-control-plane.avi-6ac.workers.dev`
  - Session Durable Objects with SQLite storage
  - WebSocket support for real-time events
  - REST API for session management
  - HMAC token auth for Modal
  - **Chat history persistence** - sends last 100 messages + 500 events on client subscribe
- [x] Modal Sandbox (Python) - Deployed
  - Sandbox execution environment
  - Git clone and branch management
  - Claude Code CLI execution
  - Event streaming to control plane
- [x] Database schema (`packages/db/src/schema/cloud-workspaces.ts`)
- [x] tRPC router (`packages/trpc/src/router/cloud-workspace/`)

### Desktop App
- [x] Desktop sidebar - Cloud workspaces section
- [x] Desktop CloudWorkspaceView - WebView embedding web app

### Web App - Phase 1-4 Complete
- [x] **Phase 1: Chat History Persistence**
  - Control plane sends historical messages/events on subscribe
  - Web hook handles `history` message type
  - Events prepopulated on reconnect

- [x] **Phase 2: Home Page & Session List**
  - `/cloud` landing page with welcome message
  - Session sidebar with search/filter
  - Active/Inactive session grouping (7-day threshold)
  - Relative time display
  - New Session button

- [x] **Phase 3: New Session Flow**
  - `/cloud/new` page with form
  - Repository selection dropdown
  - Title input (optional)
  - Model selection (Sonnet 4, Opus 4, Haiku 3.5)
  - Base branch input
  - Form validation and error handling
  - tRPC mutation integration

- [x] **Phase 4: User Messages Display**
  - User messages shown in conversation
  - Different styling for user vs assistant messages
  - User messages added to event stream when sent

### PR
- [x] PR created: https://github.com/superset-sh/superset/pull/1082

## Architecture: Bridge Pattern

Based on [ColeMurray/background-agents](https://github.com/ColeMurray/background-agents) and [Ramp's blog post](https://builders.ramp.com/post/why-we-built-our-background-agent):

### Data Flow
```
User → Web App → Control Plane (WebSocket) → Sandbox (WebSocket) → Claude
                       ↑                           ↓
                       └────── Events ─────────────┘
```

### Key Files
- `packages/control-plane/src/session/durable-object.ts` - Session DO with SQLite, history, events
- `packages/control-plane/src/types.ts` - Type definitions including HistoricalMessage
- `packages/sandbox/app.py` - Modal sandbox with Claude CLI execution
- `apps/web/src/app/cloud/page.tsx` - Cloud home page
- `apps/web/src/app/cloud/new/page.tsx` - New session page
- `apps/web/src/app/cloud/[sessionId]/page.tsx` - Session detail page
- `apps/web/src/app/cloud/[sessionId]/hooks/useCloudSession.ts` - WebSocket hook with history
- `apps/web/src/app/cloud/[sessionId]/components/CloudWorkspaceContent/` - Session UI

## Pending - Sprint 2 (Polish)

### Phase 5: Tool Call Display
- [ ] Create tool-formatters.ts for smart summaries
- [ ] Create ToolCallItem component with expand/collapse
- [ ] Create ToolCallGroup for consecutive same-type calls
- [ ] Add tool icons (file, terminal, search, etc.)

### Phase 6: Processing States
- [ ] Thinking indicator with animated pulse
- [ ] Connection status badge (green/yellow/red)
- [ ] Sandbox status display
- [ ] Input placeholder states

### Phase 7: Markdown Rendering
- [ ] SafeMarkdown component with rehype-sanitize
- [ ] Style code blocks with syntax highlighting
- [ ] Support tables, lists, blockquotes

## Pending - Sprint 3 (Full Feature Parity)

### Phase 8: Right Sidebar (Session Details)
- [ ] SessionDetailsSidebar component
- [ ] Metadata section (model, time, repo)
- [ ] PR/Branch artifacts display
- [ ] Files changed section
- [ ] Collapsible sections

### Phase 9: Event Deduplication
- [ ] Dedupe by callId for tool_call events
- [ ] Dedupe execution_complete by messageId
- [ ] Error display banner with reconnect

### Phase 10: Three-Panel Layout
- [ ] SidebarLayout wrapper component
- [ ] Left sidebar (sessions) persistent across pages
- [ ] Right sidebar (details) responsive
- [ ] Sidebar context for state management

## Test Results
- [x] Control plane health check: Working
- [x] Session creation: Working
- [x] Session state retrieval: Working
- [x] Event storage and retrieval: Working
- [x] Modal sandbox health: Working
- [x] Sandbox spawning: Working
- [x] Git clone in sandbox: Working
- [x] Branch checkout: Working
- [x] Events streaming to control plane: Working
- [x] Bridge connection: Working
- [x] Prompt execution with Claude: Working
- [x] Chat history on reconnect: Working

## Environment Variables
```
NEXT_PUBLIC_CONTROL_PLANE_URL=https://superset-control-plane.avi-6ac.workers.dev
```

## Commands
```bash
# Deploy control plane
cd packages/control-plane && wrangler deploy

# Deploy sandbox
modal deploy packages/sandbox/app.py

# Run web app
bun dev --filter=web

# Spawn sandbox for testing
curl -X POST "https://superset-control-plane.avi-6ac.workers.dev/api/sessions/{sessionId}/spawn-sandbox"
```
