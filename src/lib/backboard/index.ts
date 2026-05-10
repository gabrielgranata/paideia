/**
 * Backboard memory + RAG integration for Paideia.
 *
 * Backboard is retrieval over composed prose; never source of truth.
 * Postgres is ground truth. Memory informs which question to ask next;
 * never what to say on the student's behalf.
 */

export {
  BackboardClient,
  getBackboardClient,
  type AddMessageOptions,
  type BackboardAssistant,
  type BackboardDocument,
  type BackboardDocumentStatus,
  type BackboardMemory,
  type BackboardMemoryOperationStatus,
  type BackboardMessage,
  type BackboardMessageResponse,
  type BackboardThread,
} from "./client";

export { getOrCreateScope, type ScopeType } from "./scopes";

export { retrieveStudentMemory, retrieveLessonContext } from "./retrieval";

export {
  writeStudentReadingMemory,
  writeLessonReading,
  writeCohortPattern,
  writeTeacherNote,
} from "./writes";

export { waitForMemory } from "./poll";
