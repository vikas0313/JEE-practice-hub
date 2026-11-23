import { getSettings, updateSettings, setImportedMocksProvider } from './db';
import { seedImportedSyllabusTopics } from './syllabusSeed';
import * as importedMod from './importedQuestions';
const { clearImportedCache, getImportedQuestions } = importedMod;

export interface JeeMocksImportResult {
  success: boolean;
  topicsAdded: number;
  questionsCount: number;
  physicsQuestions: number;
  chemistryQuestions: number;
  mathQuestions: number;
}

/**
 * Imports all questions from https://github.com/skunktank69/jee_mocks_db
 * and adds all missing syllabus topics into the controlled syllabus.
 */
export function importJeeMocksDb(): JeeMocksImportResult {
  // 0. Register provider in db
  setImportedMocksProvider(importedMod);

  // 1. Add all missing syllabus topics
  const { topicsCreated } = seedImportedSyllabusTopics();

  // 2. Enable imported mocks in settings
  updateSettings({ flag_imported_mocks_enabled: true });

  // 3. Clear cache to bind fresh chapter/topic mappings
  clearImportedCache();

  const allImported = getImportedQuestions();
  const physicsQuestions = allImported.filter(q => q.id.startsWith('JM-PHY-')).length;
  const chemistryQuestions = allImported.filter(q => q.id.startsWith('JM-CHE-')).length;
  const mathQuestions = allImported.filter(q => q.id.startsWith('JM-MAT-')).length;

  return {
    success: true,
    topicsAdded: topicsCreated,
    questionsCount: allImported.length,
    physicsQuestions,
    chemistryQuestions,
    mathQuestions,
  };
}

export function isJeeMocksDbImported(): boolean {
  return Boolean(getSettings().flag_imported_mocks_enabled);
}

