'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { api } from '@/lib/api';
import { FullKit, Flashcard, Question } from '@/lib/types';
import { PracticeModal } from '@/components/PracticeModal';
import { FlashcardModal } from '@/components/FlashcardModal';
import { QuestionModal } from '@/components/QuestionModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DayScheduleDetail } from '@/components/DayScheduleDetail';
import { useNotification } from '@/context/NotificationContext';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Plus,
    RefreshCw,
} from 'lucide-react';

const tabs = ['Brief', 'Questions', 'Schedule', 'Role', 'Flashcards'] as const;
type Tab = (typeof tabs)[number];

function EditableText({
    value,
    label,
    onSave,
}: {
    value: string;
    label: string;
    onSave: (value: string) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => setDraft(value), [value]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onSave(draft);
            setEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex justify-between gap-4">
                <h3 className="font-semibold text-zinc-900">{label}</h3>
                <button
                    disabled={isSaving}
                    onClick={() => (editing ? handleSave() : setEditing(true))}
                    className="text-sm font-medium text-zinc-700 underline hover:text-zinc-950 disabled:opacity-50"
                >
                    {editing ? (isSaving ? 'Saving…' : 'Save') : 'Edit'}
                </button>
            </div>
            {editing ? (
                <textarea
                    value={draft}
                    disabled={isSaving}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={5}
                    className="w-full rounded border border-zinc-300 p-3 text-sm outline-none focus:border-zinc-900 disabled:bg-zinc-50"
                />
            ) : (
                <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {value || 'No information available.'}
                </p>
            )}
        </section>
    );
}

function Workspace() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { notify } = useNotification();

    const [kit, setKit] = useState<FullKit | null>(null);
    const [tab, setTab] = useState<Tab>('Brief');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [practice, setPractice] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [days, setDays] = useState(7);
    const [busyAction, setBusyAction] = useState(false);

    const [activeScheduleDay, setActiveScheduleDay] = useState<number | null>(null);

    const [questionModalState, setQuestionModalState] = useState<{
        isOpen: boolean;
        initialData?: Question;
        targetDayForNew?: number;
    }>({ isOpen: false });

    const [flashcardModalState, setFlashcardModalState] = useState<{
        isOpen: boolean;
        card?: Flashcard;
    }>({ isOpen: false });

    const [confirmModalState, setConfirmModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => { },
    });

    const load = useCallback(
        () =>
            api<FullKit>(`/kits/${id}`, {}, 0)
                .then((result) => {
                    setKit(result);
                    setDays(result.schedule.days_available);
                    if (!selectedCategory && result.questions.length > 0) {
                        setSelectedCategory(result.questions[0].category);
                    }
                })
                .catch(() => notify('Could not load this kit.')),
        [id, notify, selectedCategory]
    );

    useEffect(() => {
        load();
    }, [load]);

    const categories = useMemo(() => {
        if (!kit) return [];
        const list = Array.from(
            new Set(kit.questions.map((q) => q.category).filter(Boolean))
        );
        return list.length
            ? list
            : ['technical', 'behavioural', 'system-design', 'company-fit'];
    }, [kit]);

    useEffect(() => {
        if (!selectedCategory && categories.length > 0) {
            setSelectedCategory(categories[0]);
        }
    }, [categories, selectedCategory]);

    const weakFlashcards = useMemo(
        () =>
            [...(kit?.flashcards ?? [])]
                .filter(
                    (card) =>
                        card.confidence === null || card.confidence <= 1
                )
                .sort(
                    (a, b) =>
                        (a.confidence ?? 0) - (b.confidence ?? 0)
                ),
        [kit?.flashcards]
    );

    if (!kit) {
        return (
            <main className="grid min-h-screen place-items-center text-sm text-zinc-500">
                Loading kit…
            </main>
        );
    }

    const updateBrief = async (
        key: 'summary' | 'what_they_do' | 'hiring_process',
        value: string
    ) => {
        const prior = kit;
        setKit({
            ...kit,
            company_brief: { ...kit.company_brief, [key]: value },
        });

        try {
            await api(
                `/kits/${id}/company-brief`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ [key]: value }),
                },
                0
            );
        } catch {
            setKit(prior);
            notify('Brief edit was not saved.');
        }
    };

    const regenerateBrief = async () => {
        if (busyAction) return;

        setBusyAction(true);

        try {
            const result = await api<{
                company_brief: FullKit['company_brief'];
            }>(
                `/kits/${id}/regenerate-brief`,
                { method: 'POST' },
                0
            );

            setKit({
                ...kit,
                company_brief: result.company_brief,
            });

            notify('Company brief regenerated successfully.', 'success');
        } catch {
            notify('Could not regenerate company brief.');
        } finally {
            setBusyAction(false);
        }
    };

    const filteredQuestions = kit.questions.filter(
        (question) => question.category === selectedCategory
    );

    const saveQuestion = async (
        questionId: string,
        data: {
            prompt: string;
            answer_outline: string;
            category: string;
            difficulty: 1 | 2 | 3;
        }
    ) => {
        const prior = kit;

        setKit({
            ...kit,
            questions: kit.questions.map((item) =>
                item.id === questionId
                    ? { ...item, ...data, is_edited: true }
                    : item
            ),
        });

        try {
            await api(
                `/kits/${id}/questions/${questionId}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                },
                0
            );
        } catch {
            setKit(prior);
            notify('Question edit was not saved.');
        }
    };

    const createQuestion = async (
        data: {
            prompt: string;
            answer_outline: string;
            category: string;
            difficulty: 1 | 2 | 3;
        },
        targetDay?: number
    ) => {
        const requirement_ids = kit.role.requirements
            .filter((r) => r.priority === 'must')
            .slice(0, 1)
            .map((r) => r.id);

        try {
            const result = await api<{ question: Question }>(
                `/kits/${id}/questions`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        ...data,
                        requirement_ids,
                    }),
                },
                0
            );

            let updatedSchedule = kit.schedule;

            if (
                targetDay &&
                targetDay <= kit.schedule.days_available
            ) {
                const scheduleRes = await api<{
                    schedule: FullKit['schedule'];
                }>(
                    `/kits/${id}/questions/${result.question.id}/schedule`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({ targetDay }),
                    },
                    0
                );

                updatedSchedule = scheduleRes.schedule;
            }

            setKit({
                ...kit,
                questions: [...kit.questions, result.question],
                schedule: updatedSchedule,
            });

            notify('Question added successfully.', 'success');
        } catch {
            notify('Could not add question.');
        }
    };

    const removeQuestion = async (questionId: string) => {
        const prior = kit;

        setKit({
            ...kit,
            questions: kit.questions.filter(
                (question) => question.id !== questionId
            ),
            schedule: {
                ...kit.schedule,
                days: kit.schedule.days.map((day) => ({
                    ...day,
                    question_ids: day.question_ids.filter(
                        (qid) => qid !== questionId
                    ),
                })),
            },
        });

        try {
            await api(
                `/kits/${id}/questions/${questionId}`,
                { method: 'DELETE' },
                0
            );
        } catch {
            setKit(prior);
            notify('Question was not deleted.');
        }
    };

    const reorderQuestions = async (
        questionId: string,
        direction: -1 | 1
    ) => {
        if (busyAction) return;

        const current = kit.questions;
        const index = current.findIndex(
            (question) => question.id === questionId
        );

        const target = index + direction;

        if (target < 0 || target >= current.length) return;

        setBusyAction(true);

        const questions = [...current];
        [questions[index], questions[target]] = [
            questions[target],
            questions[index],
        ];

        setKit({ ...kit, questions });

        try {
            await api(
                `/kits/${id}/questions/reorder`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        questionIds: questions.map(
                            (question) => question.id
                        ),
                    }),
                },
                0
            );
        } catch {
            setKit({ ...kit, questions: current });
            notify('Order was not saved.');
        } finally {
            setBusyAction(false);
        }
    };

    const regenerateCategory = async () => {
        if (busyAction) return;

        setConfirmModalState({
            isOpen: true,
            title: `Regenerate ${selectedCategory}?`,
            message: `Regenerate unedited ${selectedCategory} questions? All edited and custom questions will be preserved.`,
            action: async () => {
                setBusyAction(true);

                try {
                    const result = await api<{
                        questions: Question[];
                        coverage: FullKit['coverage'];
                    }>(
                        `/kits/${id}/regenerate-category`,
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                category: selectedCategory,
                            }),
                        },
                        0
                    );

                    setKit({
                        ...kit,
                        questions: result.questions,
                        coverage: result.coverage,
                    });

                    notify(
                        `${selectedCategory} questions regenerated.`,
                        'success'
                    );
                } catch {
                    notify('Category regeneration failed.');
                } finally {
                    setBusyAction(false);
                }
            },
        });
    };

    const shiftQuestionSchedule = async (
        questionId: string,
        targetDay: number
    ) => {
        try {
            const result = await api<{
                schedule: FullKit['schedule'];
            }>(
                `/kits/${id}/questions/${questionId}/schedule`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ targetDay }),
                },
                0
            );

            setKit({
                ...kit,
                schedule: result.schedule,
            });

            notify(
                `Question moved to Day ${targetDay}.`,
                'success'
            );
        } catch {
            notify('Could not shift question to targeted day.');
        }
    };

    const recalculateSchedule = async () => {
        if (busyAction) return;

        setBusyAction(true);

        try {
            const result = await api<{
                schedule: FullKit['schedule'];
            }>(
                `/kits/${id}/regenerate-schedule`,
                {
                    method: 'POST',
                    body: JSON.stringify({ days }),
                },
                0
            );

            setKit({
                ...kit,
                schedule: result.schedule,
            });

            notify('Schedule recalculated.', 'success');
        } catch {
            notify('Could not recalculate schedule.');
        } finally {
            setBusyAction(false);
        }
    };

    const updateCard = (card: Flashcard) =>
        setKit((current) =>
            current
                ? {
                    ...current,
                    flashcards: current.flashcards.map((item) =>
                        item.id === card.id ? card : item
                    ),
                }
                : current
        );

    const saveFlashcard = async (
        data: { front: string; back: string },
        cardId?: string
    ) => {
        if (cardId) {
            const existing = kit.flashcards.find(
                (c) => c.id === cardId
            );

            if (!existing) return;

            const edited: Flashcard = {
                ...existing,
                front: data.front,
                back: data.back,
                is_edited: true,
            };

            updateCard(edited);

            try {
                await api(
                    `/kits/${id}/flashcards/${cardId}`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({
                            front: data.front,
                            back: data.back,
                        }),
                    },
                    0
                );
            } catch {
                load();
                notify('Flashcard edit was not saved.');
            }
        } else {
            try {
                const result = await api<{
                    flashcard: Flashcard;
                }>(
                    `/kits/${id}/flashcards`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            front: data.front,
                            back: data.back,
                            requirement_ids: [],
                        }),
                    },
                    0
                );

                setKit({
                    ...kit,
                    flashcards: [
                        ...kit.flashcards,
                        result.flashcard,
                    ],
                });

                notify('Flashcard added.', 'success');
            } catch {
                notify('Could not add flashcard.');
            }
        }
    };

    const deleteFlashcard = async (cardId: string) => {
        setConfirmModalState({
            isOpen: true,
            title: 'Delete Flashcard?',
            message:
                'Are you sure you want to permanently delete this flashcard?',
            action: async () => {
                const prior = kit;

                setKit({
                    ...kit,
                    flashcards: kit.flashcards.filter(
                        (card) => card.id !== cardId
                    ),
                });

                try {
                    await api(
                        `/kits/${id}/flashcards/${cardId}`,
                        { method: 'DELETE' },
                        0
                    );
                } catch {
                    setKit(prior);
                    notify('Flashcard was not deleted.');
                }
            },
        });
    };

    const reorderFlashcards = async (
        cardId: string,
        direction: -1 | 1
    ) => {
        if (busyAction) return;

        const current = kit.flashcards;
        const index = current.findIndex(
            (c) => c.id === cardId
        );

        const target = index + direction;

        if (target < 0 || target >= current.length) return;

        setBusyAction(true);

        const flashcards = [...current];

        [flashcards[index], flashcards[target]] = [
            flashcards[target],
            flashcards[index],
        ];

        setKit({ ...kit, flashcards });

        try {
            await api(
                `/kits/${id}/flashcards/reorder`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        flashcardIds: flashcards.map(
                            (c) => c.id
                        ),
                    }),
                },
                0
            );
        } catch {
            setKit({
                ...kit,
                flashcards: current,
            });

            notify('Flashcard order was not saved.');
        } finally {
            setBusyAction(false);
        }
    };

    const activeDayObject = kit.schedule.days.find(
        (d) => d.day === activeScheduleDay
    );

    const activeDayQuestions = activeDayObject
        ? activeDayObject.question_ids
            .map((qid) =>
                kit.questions.find((q) => q.id === qid)
            )
            .filter((q): q is Question => Boolean(q))
        : [];

    return (
        <main className="min-h-screen bg-zinc-100">
            <header className="border-b border-zinc-200 bg-white">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <button
                            onClick={() =>
                                router.push('/dashboard')
                            }
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 underline hover:text-zinc-950"
                        >
                            <ArrowLeft
                                size={16}
                                className="shrink-0"
                                aria-hidden="true"
                            />
                            Dashboard
                        </button>

                        <h1 className="mt-1 text-lg font-semibold text-zinc-900">
                            {kit.source.company || 'Company'} ·{' '}
                            {kit.role.seniority} {kit.role.title}
                        </h1>

                        <p className="text-xs text-zinc-500">
                            Researched{' '}
                            {new Date(
                                kit.source.researched_at
                            ).toLocaleDateString()}
                        </p>
                    </div>

                    <button
                        onClick={() => setPractice(true)}
                        className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                        Start practice
                    </button>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-5 py-7">
                <nav
                    aria-label="Kit sections"
                    className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-300"
                >
                    {tabs.map((item) => (
                        <button
                            key={item}
                            onClick={() => setTab(item)}
                            className={`whitespace-nowrap px-4 py-3 text-sm transition-colors ${tab === item
                                    ? 'border-b-2 border-zinc-950 font-semibold text-zinc-950'
                                    : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </nav>

                {tab === 'Brief' && (
                    <div className="grid gap-4">
                        <div className="flex justify-end">
                            <button
                                disabled={busyAction}
                                onClick={regenerateBrief}
                                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                            >
                                {busyAction
                                    ? 'Regenerating…'
                                    : 'Regenerate brief'}
                            </button>
                        </div>

                        <EditableText
                            label="Summary"
                            value={kit.company_brief.summary}
                            onSave={(value) =>
                                updateBrief('summary', value)
                            }
                        />

                        <EditableText
                            label="What they do"
                            value={kit.company_brief.what_they_do}
                            onSave={(value) =>
                                updateBrief(
                                    'what_they_do',
                                    value
                                )
                            }
                        />

                        <EditableText
                            label="Hiring process"
                            value={
                                kit.company_brief.hiring_process ||
                                ''
                            }
                            onSave={(value) =>
                                updateBrief(
                                    'hiring_process',
                                    value
                                )
                            }
                        />

                        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                            <h3 className="font-semibold text-zinc-900">
                                Verified sources
                            </h3>

                            <ul className="mt-3 grid gap-2 text-sm">
                                {kit.company_brief.sources.map(
                                    (url) => (
                                        <li key={url}>
                                            <a
                                                className="break-all text-zinc-600 underline hover:text-zinc-950"
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {url}
                                            </a>
                                        </li>
                                    )
                                )}
                            </ul>
                        </section>
                    </div>
                )}

                {tab === 'Questions' && (
                    <section>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                                    Question Categories
                                </h2>

                                <p className="text-xs text-zinc-500">
                                    Showing questions for:{' '}
                                    <span className="font-semibold text-zinc-900">
                                        {selectedCategory}
                                    </span>
                                </p>
                            </div>

                            <button
                                disabled={busyAction}
                                onClick={regenerateCategory}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                                <RefreshCw
                                    size={14}
                                    className="shrink-0"
                                    aria-hidden="true"
                                />

                                <span>
                                    {busyAction
                                        ? 'Regenerating…'
                                        : `Regenerate "${selectedCategory}"`}
                                </span>
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {categories.map((item) => (
                                <button
                                    key={item}
                                    onClick={() =>
                                        setSelectedCategory(item)
                                    }
                                    className={`rounded-full px-3 py-1.5 text-xs transition-all ${selectedCategory === item
                                            ? 'bg-zinc-950 font-medium text-white shadow-sm'
                                            : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                                        }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6 grid gap-3">
                            {filteredQuestions.map((question) => (
                                <QuestionCard
                                    key={question.id}
                                    question={question}
                                    onEdit={() =>
                                        setQuestionModalState({
                                            isOpen: true,
                                            initialData: question,
                                        })
                                    }
                                    onDelete={() =>
                                        setConfirmModalState({
                                            isOpen: true,
                                            title: 'Delete Question?',
                                            message:
                                                'Are you sure you want to delete this question? It will be removed from your schedule.',
                                            action: () =>
                                                removeQuestion(
                                                    question.id
                                                ),
                                        })
                                    }
                                    onMove={reorderQuestions}
                                    disableActions={busyAction}
                                />
                            ))}

                            {filteredQuestions.length === 0 && (
                                <p className="rounded border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
                                    No {selectedCategory} questions yet.
                                </p>
                            )}

                            <button
                                onClick={() =>
                                    setQuestionModalState({
                                        isOpen: true,
                                        initialData: undefined,
                                    })
                                }
                                className="inline-flex items-center justify-self-start gap-1.5 rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                            >
                                <Plus
                                    size={16}
                                    className="shrink-0"
                                    aria-hidden="true"
                                />
                                Add question
                            </button>
                        </div>
                    </section>
                )}

                {tab === 'Schedule' && (
                    <section>
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Study schedule
                                </h2>

                                <p className="text-sm text-zinc-600">
                                    Deterministically planned. Click on any
                                    day to inspect details, add/edit items, or
                                    shift questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    aria-label="Days available"
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={days}
                                    onChange={(event) =>
                                        setDays(
                                            Number(
                                                event.target.value
                                            )
                                        )
                                    }
                                    className="w-20 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-950"
                                />

                                <button
                                    disabled={busyAction}
                                    onClick={recalculateSchedule}
                                    className="rounded bg-zinc-950 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {busyAction
                                        ? 'Calculating…'
                                        : 'Recalculate'}
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {kit.schedule.days.map((day) => {
                                const dayQuestions =
                                    day.question_ids
                                        .map((qid) =>
                                            kit.questions.find(
                                                (q) =>
                                                    q.id === qid
                                            )
                                        )
                                        .filter(
                                            (
                                                q
                                            ): q is Question =>
                                                Boolean(q)
                                        );

                                const uniqueReqs =
                                    Array.from(
                                        new Set(
                                            dayQuestions.flatMap(
                                                (q) =>
                                                    q.requirement_ids
                                            )
                                        )
                                    );

                                return (
                                    <article
                                        key={day.day}
                                        className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                                <h3 className="font-semibold text-zinc-950">
                                                    Day {day.day} ·{' '}
                                                    {day.focus}
                                                </h3>

                                                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                                    {day.minutes} min
                                                </span>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-xs text-zinc-600">
                                                    <span>
                                                        Total questions
                                                        assigned:
                                                    </span>

                                                    <span className="font-semibold text-zinc-900">
                                                        {
                                                            day
                                                                .question_ids
                                                                .length
                                                        }
                                                    </span>
                                                </div>

                                                {uniqueReqs.length >
                                                    0 && (
                                                        <div className="pt-2">
                                                            <p className="text-[11px] font-medium uppercase text-zinc-400">
                                                                Targeted
                                                                Requirements:
                                                            </p>

                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {uniqueReqs.map(
                                                                    (
                                                                        reqId
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                reqId
                                                                            }
                                                                            className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700"
                                                                        >
                                                                            {
                                                                                reqId
                                                                            }
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="mt-5 border-t border-zinc-100 pt-3">
                                            <button
                                                onClick={() => setActiveScheduleDay(day.day)}
                                                className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-zinc-300 bg-zinc-50 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                                            >
                                                <span>Inspect & Manage Day {day.day}</span>
                                                <ArrowRight size={14} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}

                {tab === 'Role' && (
                    <section className="grid gap-4 md:grid-cols-2">
                        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="font-semibold text-zinc-900">
                                Responsibilities
                            </h2>

                            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
                                {kit.role.responsibilities.map(
                                    (item, index) => (
                                        <li key={index}>{item}</li>
                                    )
                                )}
                            </ul>
                        </article>

                        <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="font-semibold text-zinc-900">
                                Requirements
                            </h2>

                            <ul className="mt-3 grid gap-3">
                                {kit.role.requirements.map(
                                    (requirement) => (
                                        <li
                                            key={requirement.id}
                                            className="text-sm"
                                        >
                                            <span className="mr-2 rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium text-zinc-800">
                                                {requirement.id}
                                            </span>

                                            <span className="font-semibold capitalize text-zinc-900">
                                                {
                                                    requirement.priority
                                                }
                                            </span>{' '}
                                            · {requirement.text}
                                        </li>
                                    )
                                )}
                            </ul>

                            <p className="mt-5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                                Coverage passes:{' '}
                                {kit.coverage.passes}.{' '}
                                {kit.coverage
                                    .uncovered_requirement_ids
                                    .length
                                    ? `Uncovered: ${kit.coverage.uncovered_requirement_ids.join(
                                        ', '
                                    )}`
                                    : 'All must-have requirements covered.'}
                            </p>
                        </article>
                    </section>
                )}

                {tab === 'Flashcards' && (
                    <section>
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Flashcards
                                </h2>

                                <p className="text-sm text-zinc-600">
                                    Unreviewed and hard cards appear first in
                                    practice sessions.
                                </p>
                            </div>

                            <button
                                onClick={() =>
                                    setFlashcardModalState({
                                        isOpen: true,
                                        card: undefined,
                                    })
                                }
                                className="inline-flex items-center gap-1.5 rounded bg-zinc-950 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                            >
                                <Plus
                                    size={16}
                                    className="shrink-0"
                                    aria-hidden="true"
                                />
                                Add flashcard
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {kit.flashcards.map((card, idx) => (
                                <article
                                    key={card.id}
                                    className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-zinc-900">
                                                {card.front}
                                            </p>

                                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                                {card.confidence ??
                                                    'new'}
                                            </span>
                                        </div>

                                        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">
                                            {card.back}
                                        </p>

                                        <p className="mt-3 font-mono text-xs text-zinc-400">
                                            {card.requirement_ids
                                                .join(', ') ||
                                                'No linked requirement'}
                                        </p>
                                    </div>

                                    <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                                        <div className="flex gap-2">
                                            <button
                                                disabled={
                                                    busyAction ||
                                                    idx === 0
                                                }
                                                onClick={() =>
                                                    reorderFlashcards(
                                                        card.id,
                                                        -1
                                                    )
                                                }
                                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                                                title="Move Up"
                                                aria-label="Move Up"
                                            >
                                                <ArrowUp
                                                    size={16}
                                                    aria-hidden="true"
                                                />
                                            </button>

                                            <button
                                                disabled={
                                                    busyAction ||
                                                    idx ===
                                                    kit
                                                        .flashcards
                                                        .length -
                                                    1
                                                }
                                                onClick={() =>
                                                    reorderFlashcards(
                                                        card.id,
                                                        1
                                                    )
                                                }
                                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                                                title="Move Down"
                                                aria-label="Move Down"
                                            >
                                                <ArrowDown
                                                    size={16}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() =>
                                                    setFlashcardModalState(
                                                        {
                                                            isOpen: true,
                                                            card,
                                                        }
                                                    )
                                                }
                                                className="font-medium text-zinc-700 underline hover:text-zinc-950"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                onClick={() =>
                                                    deleteFlashcard(
                                                        card.id
                                                    )
                                                }
                                                className="font-medium text-red-600 underline hover:text-red-800"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <section className="mt-7 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="font-semibold text-zinc-900">
                                Weak spots report
                            </h2>

                            <p className="mt-1 text-sm text-zinc-600">
                                Prioritize these unreviewed or hard concepts
                                in your upcoming practice sessions.
                            </p>

                            {weakFlashcards.length ? (
                                <ul className="mt-4 grid gap-2 text-sm">
                                    {weakFlashcards.map((card) => (
                                        <li
                                            key={card.id}
                                            className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 p-3"
                                        >
                                            <span className="font-medium text-zinc-900">
                                                {card.front}
                                            </span>

                                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                                {card.confidence === 1
                                                    ? 'Marked hard'
                                                    : 'Not reviewed'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-sm text-zinc-500">
                                    No weak spots identified. Keep practising
                                    to maintain your mastery.
                                </p>
                            )}
                        </section>
                    </section>
                )}
            </div>

            {selectedQuestion && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4"
                >
                    <article className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
                        <button
                            onClick={() =>
                                setSelectedQuestion(null)
                            }
                            className="float-right text-sm text-zinc-500 underline hover:text-zinc-800"
                        >
                            Close
                        </button>

                        <h2 className="pr-12 text-lg font-semibold text-zinc-950">
                            {selectedQuestion.prompt}
                        </h2>

                        <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
                            {selectedQuestion.answer_outline}
                        </p>
                    </article>
                </div>
            )}

            {practice && (
                <PracticeModal
                    kitId={id}
                    cards={kit.flashcards}
                    onClose={() => setPractice(false)}
                    onUpdated={updateCard}
                />
            )}

            {activeScheduleDay !== null &&
                activeDayObject && (
                    <DayScheduleDetail
                        isOpen={true}
                        dayNumber={activeScheduleDay}
                        focus={activeDayObject.focus}
                        minutes={activeDayObject.minutes}
                        totalDays={kit.schedule.days_available}
                        questions={activeDayQuestions}
                        onClose={() =>
                            setActiveScheduleDay(null)
                        }
                        onShiftQuestion={shiftQuestionSchedule}
                        onEditQuestion={(question) =>
                            setQuestionModalState({
                                isOpen: true,
                                initialData: question,
                            })
                        }
                        onDeleteQuestion={async (
                            questionId
                        ) => {
                            setConfirmModalState({
                                isOpen: true,
                                title: 'Delete Question?',
                                message:
                                    'Are you sure you want to delete this question? It will be removed from your kit and schedule.',
                                action: () =>
                                    removeQuestion(
                                        questionId
                                    ),
                            });
                        }}
                        onAddQuestion={() => {
                            setQuestionModalState({
                                isOpen: true,
                                initialData: undefined,
                                targetDayForNew:
                                    activeScheduleDay,
                            });
                        }}
                    />
                )}

            {questionModalState.isOpen && (
                <QuestionModal
                    isOpen={true}
                    availableCategories={categories}
                    initialPrompt={
                        questionModalState.initialData?.prompt
                    }
                    initialOutline={
                        questionModalState.initialData
                            ?.answer_outline
                    }
                    initialCategory={
                        questionModalState.initialData
                            ?.category || selectedCategory
                    }
                    initialDifficulty={
                        questionModalState.initialData?.difficulty
                    }
                    onClose={() =>
                        setQuestionModalState({
                            isOpen: false,
                        })
                    }
                    onSave={async (data) => {
                        if (questionModalState.initialData) {
                            await saveQuestion(
                                questionModalState.initialData.id,
                                data
                            );
                        } else {
                            await createQuestion(
                                data,
                                questionModalState.targetDayForNew
                            );
                        }
                    }}
                />
            )}

            {flashcardModalState.isOpen && (
                <FlashcardModal
                    isOpen={true}
                    title={
                        flashcardModalState.card
                            ? 'Edit Flashcard'
                            : 'Add Flashcard'
                    }
                    initialFront={
                        flashcardModalState.card?.front
                    }
                    initialBack={
                        flashcardModalState.card?.back
                    }
                    onClose={() =>
                        setFlashcardModalState({
                            isOpen: false,
                        })
                    }
                    onSave={async (data) => {
                        await saveFlashcard(
                            data,
                            flashcardModalState.card?.id
                        );
                    }}
                />
            )}

            {confirmModalState.isOpen && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmModalState.title}
                    message={confirmModalState.message}
                    onClose={() =>
                        setConfirmModalState((prev) => ({
                            ...prev,
                            isOpen: false,
                        }))
                    }
                    onConfirm={confirmModalState.action}
                />
            )}
        </main>
    );
}

function QuestionCard({
    question,
    onEdit,
    onDelete,
    onMove,
    disableActions,
}: {
    question: Question;
    onEdit: () => void;
    onDelete: () => void;
    onMove: (id: string, direction: -1 | 1) => void;
    disableActions: boolean;
}) {
    return (
        <article className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                        Difficulty: {question.difficulty}
                    </span>

                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 font-medium capitalize text-zinc-700">
                        {question.category}
                    </span>

                    {question.is_edited && (
                        <span className="rounded bg-zinc-900 px-2 py-1 font-medium text-white">
                            Edited / custom
                        </span>
                    )}

                    {question.requirement_ids.map((id) => (
                        <span
                            key={id}
                            className="rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 font-mono text-zinc-600"
                        >
                            {id}
                        </span>
                    ))}
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <div className="flex gap-1">
                        <button
                            disabled={disableActions}
                            onClick={() =>
                                onMove(question.id, -1)
                            }
                            aria-label="Move question earlier"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                        >
                            <ArrowUp
                                size={16}
                                aria-hidden="true"
                            />
                        </button>

                        <button
                            disabled={disableActions}
                            onClick={() =>
                                onMove(question.id, 1)
                            }
                            aria-label="Move question later"
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                        >
                            <ArrowDown
                                size={16}
                                aria-hidden="true"
                            />
                        </button>
                    </div>

                    <button
                        disabled={disableActions}
                        onClick={onEdit}
                        className="font-medium text-zinc-700 underline hover:text-zinc-950 disabled:opacity-50"
                    >
                        Edit
                    </button>

                    <button
                        disabled={disableActions}
                        onClick={onDelete}
                        className="font-medium text-red-600 underline hover:text-red-800 disabled:opacity-50"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div>
                <h3 className="text-base font-semibold text-zinc-950">
                    {question.prompt}
                </h3>

                <p className="mt-2.5 rounded border border-zinc-200 bg-zinc-50/70 p-3.5 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
                    {question.answer_outline}
                </p>
            </div>
        </article>
    );
}

export default function KitPage() {
    return (
        <ProtectedRoute>
            <Workspace />
        </ProtectedRoute>
    );
}