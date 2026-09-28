import { z } from "zod";

export type { Database } from "./database.types.ts";

export const visibilitySchema = z.enum(["private", "unlisted", "public"]);
export const contentStatusSchema = z.enum(["draft", "published", "archived"]);
export const questionTypeSchema = z.enum([
    "exact_text",
    "multiple_choice_single",
    "multiple_choice_multi",
]);
export const attemptStatusSchema = z.enum(["in_progress", "completed", "abandoned", "expired"]);
export const feedbackCategorySchema = z.enum([
    "incorrect_answer",
    "ambiguous_question",
    "typo",
    "bad_choices",
    "unfair_grading",
    "too_easy",
    "too_hard",
    "other",
]);
export const feedbackStatusSchema = z.enum(["open", "reviewed", "resolved", "dismissed"]);

const optionSchema = z.strictObject({ id: z.string().min(1), text: z.string().trim().min(1) });
const optionsSchema = z
    .array(optionSchema)
    .min(2)
    .superRefine((options, context) => {
        const ids = options.map((option) => option.id);
        if (new Set(ids).size !== ids.length) {
            context.addIssue({ code: "custom", message: "Choice IDs must be unique" });
        }
    });

const exactTextAnswerConfigSchema = z.strictObject({
    questionType: z.literal("exact_text"),
    acceptedAnswers: z.array(z.string().trim().min(1)).min(1),
});
const singleChoiceAnswerConfigSchema = z
    .strictObject({
        questionType: z.literal("multiple_choice_single"),
        options: optionsSchema,
        correctOptionId: z.string().min(1),
    })
    .superRefine((config, context) => {
        if (!config.options.some((option) => option.id === config.correctOptionId)) {
            context.addIssue({ code: "custom", message: "Correct choice must exist" });
        }
    });
const multiChoiceAnswerConfigSchema = z
    .strictObject({
        questionType: z.literal("multiple_choice_multi"),
        options: optionsSchema,
        correctOptionIds: z.array(z.string().min(1)).min(1),
    })
    .superRefine((config, context) => {
        const ids = new Set(config.options.map((option) => option.id));
        if (
            new Set(config.correctOptionIds).size !== config.correctOptionIds.length ||
            config.correctOptionIds.some((id) => !ids.has(id))
        ) {
            context.addIssue({
                code: "custom",
                message: "Correct choices must be unique and exist",
            });
        }
    });

export const answerConfigSchema = z.union([
    exactTextAnswerConfigSchema,
    singleChoiceAnswerConfigSchema,
    multiChoiceAnswerConfigSchema,
]);
export const gradingConfigSchema = z.discriminatedUnion("questionType", [
    z.strictObject({
        questionType: z.literal("exact_text"),
        caseSensitive: z.boolean(),
        trimWhitespace: z.boolean(),
    }),
    z.strictObject({ questionType: z.literal("multiple_choice_single") }),
    z.strictObject({ questionType: z.literal("multiple_choice_multi") }),
]);

export const questionVersionContentSchema = z
    .strictObject({
        prompt: z.string().trim().min(1),
        questionType: questionTypeSchema,
        answerConfig: answerConfigSchema,
        gradingConfig: gradingConfigSchema,
        explanation: z.string().nullable(),
    })
    .superRefine((content, context) => {
        if (
            content.answerConfig.questionType !== content.questionType ||
            content.gradingConfig.questionType !== content.questionType
        ) {
            context.addIssue({
                code: "custom",
                message: "Question configuration types must match",
            });
        }
    });

export const quizSettingsSchema = z.strictObject({
    shuffleQuestions: z.boolean(),
    showAnswersAfterCompletion: z.boolean(),
});

export const questionSnapshotSchema = z.strictObject({
    questionId: z.uuid(),
    questionVersionId: z.uuid(),
    prompt: z.string().trim().min(1),
    questionType: questionTypeSchema,
    explanation: z.string().nullable(),
});
export const answerSnapshotSchema = answerConfigSchema;
export const gradingSnapshotSchema = gradingConfigSchema;
export const settingsSnapshotSchema = quizSettingsSchema;
export const attemptQuestionSnapshotsSchema = z
    .strictObject({
        question: questionSnapshotSchema,
        answer: answerSnapshotSchema,
        grading: gradingSnapshotSchema,
    })
    .superRefine((snapshots, context) => {
        if (
            snapshots.answer.questionType !== snapshots.question.questionType ||
            snapshots.grading.questionType !== snapshots.question.questionType
        ) {
            context.addIssue({ code: "custom", message: "Snapshot question types must match" });
        }
    });

export const userResponseSchema = z.discriminatedUnion("questionType", [
    z.strictObject({ questionType: z.literal("exact_text"), text: z.string() }),
    z.strictObject({
        questionType: z.literal("multiple_choice_single"),
        optionId: z.string().min(1),
    }),
    z.strictObject({
        questionType: z.literal("multiple_choice_multi"),
        optionIds: z.array(z.string().min(1)).superRefine((ids, context) => {
            if (new Set(ids).size !== ids.length) {
                context.addIssue({ code: "custom", message: "Selected choices must be unique" });
            }
        }),
    }),
]);

export const evaluationResultSchema = z.strictObject({
    isCorrect: z.boolean(),
    pointsPossible: z.number().finite().nonnegative(),
    pointsAwarded: z.number().finite(),
    explanation: z.string().nullable(),
});
export const scoreSummarySchema = z.strictObject({
    pointsPossible: z.number().finite().nonnegative(),
    pointsAwarded: z.number().finite(),
});

export type Visibility = z.infer<typeof visibilitySchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type AnswerConfig = z.infer<typeof answerConfigSchema>;
export type GradingConfig = z.infer<typeof gradingConfigSchema>;
export type QuestionVersionContent = z.infer<typeof questionVersionContentSchema>;
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export type QuestionSnapshot = z.infer<typeof questionSnapshotSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type ScoreSummary = z.infer<typeof scoreSummarySchema>;

const apiTimestampSchema = z.iso.datetime({ offset: true });

export const tagSchema = z
    .strictObject({
        id: z.uuid(),
        name: z.string().min(1),
        slug: z.string().min(1),
        createdAt: apiTimestampSchema,
    })
    .meta({ id: "Tag" });

export const questionVersionSchema = questionVersionContentSchema
    .safeExtend({
        id: z.uuid(),
        versionNumber: z.number().int().positive(),
        createdBy: z.uuid(),
        createdAt: apiTimestampSchema,
    })
    .meta({ id: "QuestionVersion" });

const questionIdentitySchema = z.strictObject({
    id: z.uuid(),
    createdBy: z.uuid(),
    visibility: visibilitySchema,
    status: contentStatusSchema,
    createdAt: apiTimestampSchema,
    updatedAt: apiTimestampSchema,
    tags: z.array(tagSchema),
});

export const questionDetailSchema = questionIdentitySchema
    .extend({
        isOwner: z.boolean(),
        currentVersion: questionVersionSchema,
    })
    .meta({ id: "QuestionDetail" });

export const questionListResponseSchema = z
    .strictObject({
        items: z.array(questionDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "QuestionListResponse" });

export const questionVersionsResponseSchema = z
    .strictObject({ versions: z.array(questionVersionSchema) })
    .meta({ id: "QuestionVersionsResponse" });

export const tagListResponseSchema = z
    .strictObject({ tags: z.array(tagSchema) })
    .meta({ id: "TagListResponse" });

export const createQuestionBodySchema = z.strictObject({
    content: questionVersionContentSchema,
    visibility: visibilitySchema.default("private"),
    status: z.enum(["draft", "published"]).default("draft"),
});

export const updateQuestionMetadataBodySchema = z
    .strictObject({
        visibility: visibilitySchema.optional(),
        status: contentStatusSchema.optional(),
    })
    .refine((value) => value.visibility !== undefined || value.status !== undefined, {
        message: "At least one metadata field is required",
    });

export const createTagBodySchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
});

export type Tag = z.output<typeof tagSchema>;
export type QuestionVersion = z.output<typeof questionVersionSchema>;
export type QuestionDetail = z.output<typeof questionDetailSchema>;
