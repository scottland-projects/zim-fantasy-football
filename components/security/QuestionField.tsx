"use client";

import { Pencil } from "lucide-react";
import { RECOVERY_QUESTIONS } from "@/lib/recoveryQuestions";

export const CUSTOM = "__custom__";

// Shared by the post-signup setup step and the Settings "change questions"
// form — a dropdown of the fixed list, or a free-text question the user
// writes themselves ("Write my own"), each paired with an answer field.
export function QuestionField({
  label, question, answer, onQuestionChange, onAnswerChange, otherQuestion,
}: {
  label: string;
  question: string;
  answer: string;
  onQuestionChange: (q: string) => void;
  onAnswerChange: (a: string) => void;
  otherQuestion: string;
}) {
  const isCustom = !RECOVERY_QUESTIONS.includes(question);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={() => onQuestionChange(isCustom ? (RECOVERY_QUESTIONS.find((q) => q !== otherQuestion) ?? RECOVERY_QUESTIONS[0]) : CUSTOM)}
          className="text-xs text-zff-green font-medium hover:underline flex items-center gap-1"
        >
          {isCustom ? "Choose from list" : <><Pencil className="w-3 h-3" /> Write my own</>}
        </button>
      </div>
      {isCustom ? (
        <input
          type="text" value={question === CUSTOM ? "" : question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="Write your own question"
          required minLength={6} maxLength={150}
          className="input text-sm"
        />
      ) : (
        <select value={question} onChange={(e) => onQuestionChange(e.target.value)} className="select text-sm">
          {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
      )}
      <input type="text" value={answer} onChange={(e) => onAnswerChange(e.target.value)} placeholder="Your answer" required maxLength={100} className="input mt-2 text-sm" />
    </div>
  );
}
