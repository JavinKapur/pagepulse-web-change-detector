import { diffLines, diffWords, type Change } from 'diff';

export interface DiffChunk {
  type: 'added' | 'deleted' | 'unchanged';
  value: string;
  linesCount: number;
}

export interface TextDiffResult {
  hasChanges: boolean;
  addedLines: number;
  deletedLines: number;
  addedWords: number;
  deletedWords: number;
  textChangeRatio: number;
  chunks: DiffChunk[];
  summary: string;
}

export function computeTextDiff(oldText: string, newText: string): TextDiffResult {
  if (oldText === newText) {
    return {
      hasChanges: false,
      addedLines: 0,
      deletedLines: 0,
      addedWords: 0,
      deletedWords: 0,
      textChangeRatio: 0,
      chunks: [
        {
          type: 'unchanged',
          value: newText,
          linesCount: newText ? newText.split('\n').length : 0,
        },
      ],
      summary: 'No changes detected',
    };
  }

  const lineChanges: Change[] = diffLines(oldText, newText);
  let addedLines = 0;
  let deletedLines = 0;

  const chunks: DiffChunk[] = lineChanges.map((change) => {
    const linesCount = change.value.split('\n').filter((l) => l.length > 0).length || 1;
    if (change.added) {
      addedLines += linesCount;
      return { type: 'added', value: change.value, linesCount };
    }
    if (change.removed) {
      deletedLines += linesCount;
      return { type: 'deleted', value: change.value, linesCount };
    }
    return { type: 'unchanged', value: change.value, linesCount };
  });

  const wordChanges: Change[] = diffWords(oldText, newText);
  let addedWords = 0;
  let deletedWords = 0;
  let totalWordsOld = 0;
  let totalWordsNew = 0;

  for (const change of wordChanges) {
    const wordCount = change.value.trim().split(/\s+/).filter(Boolean).length;
    if (change.added) {
      addedWords += wordCount;
      totalWordsNew += wordCount;
    } else if (change.removed) {
      deletedWords += wordCount;
      totalWordsOld += wordCount;
    } else {
      totalWordsOld += wordCount;
      totalWordsNew += wordCount;
    }
  }

  const maxWords = Math.max(totalWordsOld, totalWordsNew, 1);
  const textChangeRatio = Number(((addedWords + deletedWords) / maxWords).toFixed(4));

  const summary = `+${addedLines} / -${deletedLines} lines (+${addedWords} / -${deletedWords} words)`;

  return {
    hasChanges: addedLines > 0 || deletedLines > 0,
    addedLines,
    deletedLines,
    addedWords,
    deletedWords,
    textChangeRatio,
    chunks,
    summary,
  };
}
