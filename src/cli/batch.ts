export type BatchSelectionOptions = {
  start?: number;
  count?: number;
};

export type BatchQuestion = {
  sourceNumber: number;
  text: string;
};

export type BatchSelection = {
  total: number;
  start: number;
  end: number;
  questions: BatchQuestion[];
};

export function selectBatchQuestions(content: string, options: BatchSelectionOptions = {}): BatchSelection {
  const allQuestions = content.split(/^---\s*$/m).map(part => part.trim()).filter(Boolean);
  if (!allQuestions.length) {
    throw new Error("No questions found in batch content");
  }

  const start = options.start ?? 1;
  if (!Number.isInteger(start) || start < 1) {
    throw new Error("--batch-start must be a positive integer");
  }
  if (start > allQuestions.length) {
    throw new Error(`--batch-start ${start} is outside the batch range 1..${allQuestions.length}`);
  }

  const count = options.count;
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error("--batch-count must be a positive integer");
  }

  const startIndex = start - 1;
  const endIndex = count === undefined
    ? allQuestions.length
    : Math.min(allQuestions.length, startIndex + count);
  const selected = allQuestions.slice(startIndex, endIndex).map((text, index) => ({
    sourceNumber: start + index,
    text
  }));

  return {
    total: allQuestions.length,
    start,
    end: start + selected.length - 1,
    questions: selected
  };
}
