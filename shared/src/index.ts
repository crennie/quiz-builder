import { z } from "zod";

export type { Database } from "./database.types.ts";

export const visibilitySchema = z.enum(["private", "public"]);
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

export const questionContentSchema = z
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
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type AnswerConfig = z.infer<typeof answerConfigSchema>;
export type GradingConfig = z.infer<typeof gradingConfigSchema>;
export type QuestionContent = z.infer<typeof questionContentSchema>;
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

export const questionDetailSchema = questionContentSchema
    .safeExtend({
        id: z.uuid(),
        createdBy: z.uuid(),
        visibility: visibilitySchema,
        createdAt: apiTimestampSchema,
        updatedAt: apiTimestampSchema,
        contentLockedAt: apiTimestampSchema.nullable(),
        tags: z.array(tagSchema),
        isOwner: z.boolean(),
        canEditContent: z.boolean(),
    })
    .meta({ id: "QuestionDetail" });
export const questionListResponseSchema = z
    .strictObject({
        items: z.array(questionDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "QuestionListResponse" });
export const tagListResponseSchema = z
    .strictObject({ tags: z.array(tagSchema) })
    .meta({ id: "TagListResponse" });
export const createQuestionBodySchema = z.strictObject({ content: questionContentSchema });

export const questionBatchArtifactSchema = z
    .strictObject({
        schemaVersion: z.literal(1),
        batchKey: z.uuid(),
        topic: z
            .string()
            .min(1)
            .max(200)
            .refine((value) => value.trim().length > 0),
        source: z.strictObject({
            kind: z.enum(["human", "external_agent"]),
            label: z
                .string()
                .min(1)
                .max(200)
                .refine((value) => value.trim().length > 0),
        }),
        tags: z
            .array(
                z
                    .string()
                    .min(1)
                    .max(100)
                    .refine((value) => /[\p{L}\p{N}]/u.test(value), "Tag needs a letter or number"),
            )
            .max(10),
        questions: z
            .array(
                z.strictObject({
                    key: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
                    content: questionContentSchema,
                }),
            )
            .min(1)
            .max(20),
    })
    .superRefine((artifact, context) => {
        const keys = artifact.questions.map((question) => question.key);
        if (new Set(keys).size !== keys.length)
            context.addIssue({ code: "custom", message: "Question keys must be unique" });
    });

export const questionBatchItemSchema = z.strictObject({
    key: z.string(),
    questionId: z.uuid(),
});
export const questionBatchSchema = z.strictObject({
    id: z.uuid(),
    artifact: questionBatchArtifactSchema,
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: apiTimestampSchema,
    items: z.array(questionBatchItemSchema),
});
export const questionBatchSummarySchema = questionBatchSchema
    .pick({
        id: true,
        artifactSha256: true,
        createdAt: true,
    })
    .extend({
        topic: z.string(),
        questionCount: z.number().int().positive(),
        materializedCount: z.number().int().nonnegative(),
    });
export const questionBatchListSchema = z.strictObject({
    batches: z.array(questionBatchSummarySchema),
});
export type QuestionBatchArtifact = z.output<typeof questionBatchArtifactSchema>;
export type QuestionBatch = z.output<typeof questionBatchSchema>;

export const createTagBodySchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
});

export const quizQuestionInputSchema = z.strictObject({
    questionId: z.uuid(),
    points: z.number().finite().nonnegative(),
    required: z.boolean(),
    timeLimitSeconds: z.number().int().positive().nullable(),
});

export const quizContentSchema = z.strictObject({
    title: z.string().trim().min(1),
    description: z.string().trim().nullable(),
    settings: quizSettingsSchema,
    questions: z.array(quizQuestionInputSchema),
});

export const quizQuestionSchema = quizQuestionInputSchema.extend({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    question: questionContentSchema,
});
export const quizDetailSchema = z
    .strictObject({
        id: z.uuid(),
        createdBy: z.uuid(),
        visibility: visibilitySchema,
        createdAt: apiTimestampSchema,
        updatedAt: apiTimestampSchema,
        tags: z.array(tagSchema),
        isOwner: z.boolean(),
        canEditContent: z.boolean(),
        title: z.string().trim().min(1),
        description: z.string().nullable(),
        settings: quizSettingsSchema,
        questions: z.array(quizQuestionSchema),
    })
    .meta({ id: "QuizDetail" });
export const quizListResponseSchema = z
    .strictObject({
        items: z.array(quizDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "QuizListResponse" });
export const createQuizBodySchema = z.strictObject({ content: quizContentSchema });
export const courseSchema = z
    .strictObject({
        id: z.uuid(),
        title: z.string().trim().min(1),
        description: z.string().nullable(),
        createdAt: apiTimestampSchema,
        updatedAt: apiTimestampSchema,
    })
    .meta({ id: "Course" });
export const lessonSchema = courseSchema
    .extend({
        courseId: z.uuid(),
        content: z.string(),
        position: z.number().int().nonnegative(),
    })
    .meta({ id: "Lesson" });
export const lessonQuizSchema = z
    .strictObject({
        lessonId: z.uuid(),
        quizId: z.uuid(),
        position: z.number().int().nonnegative(),
        quiz: quizDetailSchema,
    })
    .meta({ id: "LessonQuiz" });
export const courseListResponseSchema = z.strictObject({
    items: z.array(courseSchema),
    nextOffset: z.number().int().nonnegative().nullable(),
});
export const lessonListResponseSchema = z.strictObject({
    items: z.array(lessonSchema),
    nextOffset: z.number().int().nonnegative().nullable(),
});
export const lessonQuizListResponseSchema = z.strictObject({
    items: z.array(lessonQuizSchema),
    nextOffset: z.number().int().nonnegative().nullable(),
});
export type Tag = z.output<typeof tagSchema>;
export type QuestionDetail = z.output<typeof questionDetailSchema>;
export type QuizContent = z.output<typeof quizContentSchema>;
export type QuizQuestion = z.output<typeof quizQuestionSchema>;
export type QuizDetail = z.output<typeof quizDetailSchema>;
export type Course = z.output<typeof courseSchema>;
export type Lesson = z.output<typeof lessonSchema>;
export type LessonQuiz = z.output<typeof lessonQuizSchema>;

export const submitAnswerBodySchema = z.strictObject({ response: userResponseSchema });

export const attemptQuestionSchema = z.strictObject({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    prompt: z.string(),
    questionType: questionTypeSchema,
    options: z.array(optionSchema).nullable(),
    required: z.boolean(),
    timeLimitSeconds: z.number().int().positive().nullable(),
    pointsPossible: z.number().finite().nonnegative(),
    userResponse: userResponseSchema.nullable(),
    pointsAwarded: z.number().finite().nullable(),
    evaluationResult: evaluationResultSchema.nullable(),
    correctAnswer: answerSnapshotSchema.nullable(),
    explanation: z.string().nullable(),
    answeredAt: apiTimestampSchema.nullable(),
});

export const attemptDetailSchema = z.strictObject({
    id: z.uuid(),
    quizId: z.uuid(),
    quizTitle: z.string(),
    status: attemptStatusSchema,
    startedAt: apiTimestampSchema,
    completedAt: apiTimestampSchema.nullable(),
    settings: settingsSnapshotSchema,
    scoreSummary: scoreSummarySchema.nullable(),
    questions: z.array(attemptQuestionSchema),
});

export const attemptListResponseSchema = z.strictObject({
    items: z.array(attemptDetailSchema),
    nextOffset: z.number().int().nonnegative().nullable(),
});

export type AttemptDetail = z.output<typeof attemptDetailSchema>;

export const createFeedbackBodySchema = z
    .strictObject({
        questionId: z.uuid().optional(),
        quizId: z.uuid().optional(),
        quizAttemptQuestionId: z.uuid().optional(),
        category: feedbackCategorySchema,
        comment: z.string().trim().min(1).max(5000),
    })
    .superRefine((value, context) => {
        const targets = [value.questionId, value.quizId, value.quizAttemptQuestionId];
        if (targets.filter((target) => target !== undefined).length !== 1) {
            context.addIssue({
                code: "custom",
                message: "Exactly one feedback target is required",
            });
        }
    });

export const feedbackSchema = z.strictObject({
    id: z.uuid(),
    submittedBy: z.uuid(),
    questionId: z.uuid().nullable(),
    quizId: z.uuid().nullable(),
    quizAttemptQuestionId: z.uuid().nullable(),
    category: feedbackCategorySchema,
    comment: z.string().min(1),
    status: feedbackStatusSchema,
    createdAt: apiTimestampSchema,
    reviewedAt: apiTimestampSchema.nullable(),
});

export const feedbackListResponseSchema = z.strictObject({
    items: z.array(feedbackSchema),
    nextOffset: z.number().int().nonnegative().nullable(),
});

export const updateFeedbackStatusBodySchema = z.strictObject({ status: feedbackStatusSchema });

export type Feedback = z.output<typeof feedbackSchema>;
export type CreateFeedbackBody = z.output<typeof createFeedbackBodySchema>;
