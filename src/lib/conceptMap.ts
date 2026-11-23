// ============================================================
// Enhancement E2: Subtopic Taxonomy & Prerequisite Concept Map
// Directed Acyclic Graph (DAG) traversal, cycle detection,
// and student prerequisite readiness assessment.
// ============================================================

import { Subtopic, ConceptPrerequisite, PrerequisiteNode } from './types';

/**
 * Detect cycles in concept prerequisite relationships using DFS.
 * Returns true if a cycle is detected, false otherwise.
 */
export function detectPrerequisiteCycles(prerequisites: ConceptPrerequisite[]): boolean {
  const adj = new Map<string, string[]>();

  for (const p of prerequisites) {
    if (!adj.has(p.concept_id)) {
      adj.set(p.concept_id, []);
    }
    adj.get(p.concept_id)!.push(p.prerequisite_concept_id);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (hasCycleDFS(node)) return true;
    }
  }

  return false;
}

/**
 * Retrieve full recursive prerequisite chain for a given subtopic (topologically ordered).
 */
export function getPrerequisiteChain(
  subtopicId: string,
  allSubtopics: Subtopic[],
  prerequisites: ConceptPrerequisite[]
): Subtopic[] {
  const stMap = new Map(allSubtopics.map((st) => [st.id, st]));
  const adj = new Map<string, string[]>();

  for (const p of prerequisites) {
    if (!adj.has(p.concept_id)) {
      adj.set(p.concept_id, []);
    }
    adj.get(p.concept_id)!.push(p.prerequisite_concept_id);
  }

  const chain: Subtopic[] = [];
  const visited = new Set<string>();

  function dfs(curr: string) {
    visited.add(curr);
    const prereqs = adj.get(curr) || [];
    for (const p of prereqs) {
      if (!visited.has(p)) {
        dfs(p);
      }
    }
    if (curr !== subtopicId) {
      const st = stMap.get(curr);
      if (st) chain.push(st);
    }
  }

  dfs(subtopicId);
  return chain;
}

/**
 * Build graph nodes mapping each subtopic with its direct prerequisites, dependents,
 * and readiness state (ready if all prerequisites are completed).
 */
export function buildConceptMap(
  subtopics: Subtopic[],
  prerequisites: ConceptPrerequisite[],
  completedSubtopicIds: Set<string>
): PrerequisiteNode[] {
  const stMap = new Map(subtopics.map((st) => [st.id, st]));

  const directPrereqs = new Map<string, string[]>();
  const directDependents = new Map<string, string[]>();

  for (const p of prerequisites) {
    if (!directPrereqs.has(p.concept_id)) {
      directPrereqs.set(p.concept_id, []);
    }
    directPrereqs.get(p.concept_id)!.push(p.prerequisite_concept_id);

    if (!directDependents.has(p.prerequisite_concept_id)) {
      directDependents.set(p.prerequisite_concept_id, []);
    }
    directDependents.get(p.prerequisite_concept_id)!.push(p.concept_id);
  }

  return subtopics.map((st) => {
    const prereqIds = directPrereqs.get(st.id) || [];
    const depIds = directDependents.get(st.id) || [];

    const prereqNodes = prereqIds.map((id) => stMap.get(id)).filter(Boolean) as Subtopic[];
    const depNodes = depIds.map((id) => stMap.get(id)).filter(Boolean) as Subtopic[];

    // Ready if all prerequisites have been marked completed
    const isReady = prereqIds.every((pid) => completedSubtopicIds.has(pid));

    return {
      subtopic: st,
      prerequisites: prereqNodes,
      dependents: depNodes,
      is_ready: isReady,
    };
  });
}

