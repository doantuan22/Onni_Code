/**
 * Appended to every manager brief (manager/worker and One & One). The briefs tell a manager to
 * plan and dispatch; without this gate a question about the plan reads as an order to start it.
 */
export const MANAGER_INTENT_GATE = `Read the user's message before acting. Create tasks, dispatch workers, edit files or merge ONLY when the user has asked for work to be done. For a question about what you can do, the plan, an approach or status, answer in plain text and stop: no \`onni task create\`, no worker, no edits. Offer the plan and ask whether to proceed; if unsure whether it is an instruction, ask. The dispatch rules below apply only once work was requested.`;
