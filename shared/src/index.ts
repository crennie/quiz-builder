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
        agentRunId: z.uuid().optional(),
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
        agentOriginRunId: z.uuid().optional(),
        batchOriginId: z.uuid().optional(),
    })
    .meta({ id: "QuestionDetail" });

export const questionListResponseSchema = z
    .strictObject({
        items: z.array(questionDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "QuestionListResponse" });

export const bankQuestionDetailSchema = questionIdentitySchema
    .extend({
        isOwner: z.boolean(),
        publishedVersion: questionVersionSchema,
    })
    .meta({ id: "BankQuestionDetail" });

export const bankQuestionListResponseSchema = z
    .strictObject({
        items: z.array(bankQuestionDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "BankQuestionListResponse" });

export const questionVersionsResponseSchema = z
    .strictObject({ versions: z.array(questionVersionSchema) })
    .meta({ id: "QuestionVersionsResponse" });

export const tagListResponseSchema = z
    .strictObject({ tags: z.array(tagSchema) })
    .meta({ id: "TagListResponse" });

export const createQuestionBodySchema = z.strictObject({
    content: questionVersionContentSchema,
    visibility: visibilitySchema.default("private"),
});

export const updateQuestionMetadataBodySchema = z.strictObject({ visibility: visibilitySchema });
export const publishQuestionBodySchema = z.strictObject({ versionId: z.uuid() });
export const requestAgentQuestionBodySchema = z.strictObject({
    brief: z.string().trim().min(10).max(1000),
    requestKey: z.uuid(),
});

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
                    content: questionVersionContentSchema,
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
    versionId: z.uuid(),
    currentVersionId: z.uuid(),
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

export const workItemInputSchema = z.discriminatedUnion("type", [
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("CREATE_QUESTION"),
        brief: z.string().trim().min(10).max(1000),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("REVIEW_QUESTION"),
        versionId: z.uuid(),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("REVISE_QUESTION"),
        sourceVersionId: z.uuid(),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("APPROVE_PUBLICATION"),
        versionId: z.uuid(),
        reviewDecisionId: z.uuid(),
    }),
]);
export const workItemResultSchema = z.discriminatedUnion("type", [
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("CREATE_QUESTION"),
        questionId: z.uuid(),
        versionId: z.uuid(),
        agentRunId: z.uuid(),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("REVIEW_QUESTION"),
        decision: z.enum(["approved", "changes_requested", "rejected"]),
        findings: z.string(),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("REVISE_QUESTION"),
        versionId: z.uuid(),
        agentRunId: z.uuid(),
    }),
    z.strictObject({
        schemaVersion: z.literal(1),
        type: z.literal("APPROVE_PUBLICATION"),
        decision: z.enum(["approve_and_publish", "changes_requested", "rejected"]),
        findings: z.string(),
    }),
]);
export const workItemSchema = z.strictObject({
    id: z.uuid(),
    queueName: z.enum([
        "question-creation",
        "question-review",
        "question-revision",
        "question-ready-to-publish",
    ]),
    itemType: z.enum([
        "CREATE_QUESTION",
        "REVIEW_QUESTION",
        "REVISE_QUESTION",
        "APPROVE_PUBLICATION",
    ]),
    questionId: z.uuid().nullable(),
    questionVersionId: z.uuid().nullable(),
    versionNumber: z.number().int().positive().nullable(),
    prompt: z.string().nullable(),
    input: workItemInputSchema,
    status: z.enum(["pending", "claimed", "completed", "failed", "cancelled"]),
    attempts: z.number().int().nonnegative(),
    claimGeneration: z.number().int().nonnegative(),
    claimToken: z.uuid().nullable(),
    assignedAgentActorId: z.uuid().nullable(),
    leaseUntil: apiTimestampSchema.nullable(),
    createdAt: apiTimestampSchema,
});
export const workItemListResponseSchema = z.strictObject({ items: z.array(workItemSchema) });
export const submitQuestionReviewBodySchema = z.strictObject({ versionId: z.uuid() });
export const claimWorkItemBodySchema = z.strictObject({});
export const decideWorkItemBodySchema = z.strictObject({
    claimToken: z.uuid(),
    decision: z.enum(["approved", "approve_and_publish", "changes_requested", "rejected"]),
    findings: z.string().trim().max(5000).default(""),
});
export const failWorkItemBodySchema = z.strictObject({
    claimToken: z.uuid(),
    reason: z.string().trim().min(1).max(1000),
});
export type WorkItem = z.output<typeof workItemSchema>;

export const createTagBodySchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
});

export const quizQuestionInputSchema = z.strictObject({
    questionId: z.uuid(),
    questionVersionId: z.uuid(),
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

export const quizVersionQuestionSchema = quizQuestionInputSchema.extend({
    id: z.uuid(),
    position: z.number().int().nonnegative(),
    question: questionVersionContentSchema,
});

export const quizVersionSchema = z
    .strictObject({
        id: z.uuid(),
        versionNumber: z.number().int().positive(),
        title: z.string().min(1),
        description: z.string().nullable(),
        settings: quizSettingsSchema,
        questions: z.array(quizVersionQuestionSchema),
        createdBy: z.uuid(),
        createdAt: apiTimestampSchema,
    })
    .meta({ id: "QuizVersion" });

export const quizDetailSchema = z
    .strictObject({
        id: z.uuid(),
        createdBy: z.uuid(),
        visibility: visibilitySchema,
        status: contentStatusSchema,
        createdAt: apiTimestampSchema,
        updatedAt: apiTimestampSchema,
        tags: z.array(tagSchema),
        isOwner: z.boolean(),
        currentVersion: quizVersionSchema,
    })
    .meta({ id: "QuizDetail" });

export const quizListResponseSchema = z
    .strictObject({
        items: z.array(quizDetailSchema),
        nextOffset: z.number().int().nonnegative().nullable(),
    })
    .meta({ id: "QuizListResponse" });

export const quizVersionsResponseSchema = z
    .strictObject({ versions: z.array(quizVersionSchema) })
    .meta({ id: "QuizVersionsResponse" });

export const createQuizBodySchema = z.strictObject({
    content: quizContentSchema,
    visibility: visibilitySchema.default("private"),
    status: z.enum(["draft", "published"]).default("draft"),
});

export const updateQuizMetadataBodySchema = z
    .strictObject({
        visibility: visibilitySchema.optional(),
        status: contentStatusSchema.optional(),
    })
    .refine((value) => value.visibility !== undefined || value.status !== undefined, {
        message: "At least one metadata field is required",
    });

export type Tag = z.output<typeof tagSchema>;
export type QuestionVersion = z.output<typeof questionVersionSchema>;
export type QuestionDetail = z.output<typeof questionDetailSchema>;
export type BankQuestionDetail = z.output<typeof bankQuestionDetailSchema>;
export type QuizContent = z.output<typeof quizContentSchema>;
export type QuizVersion = z.output<typeof quizVersionSchema>;
export type QuizDetail = z.output<typeof quizDetailSchema>;

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
    quizVersionId: z.uuid(),
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
