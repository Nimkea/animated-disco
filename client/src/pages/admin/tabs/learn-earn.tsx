import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Lesson, LessonQuestion } from "@shared/schema";

type AdminLesson = Lesson & {
  questions: (LessonQuestion & { correctAnswer: number })[];
  completions?: number;
};

type LessonForm = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  estimatedMinutes: string;
  xpReward: string;
  xnrtReward: string;
  passingScore: string;
  isActive: boolean;
  isResponsibleUsage: boolean;
  sortOrder: string;
};

type QuestionForm = {
  question: string;
  optionsText: string;
  correctAnswer: string;
  explanation: string;
  sortOrder: string;
};

const emptyLessonForm: LessonForm = {
  slug: "",
  title: "",
  summary: "",
  content: "",
  category: "education",
  estimatedMinutes: "3",
  xpReward: "25",
  xnrtReward: "5",
  passingScore: "70",
  isActive: true,
  isResponsibleUsage: false,
  sortOrder: "0",
};

const emptyQuestionForm: QuestionForm = {
  question: "",
  optionsText: "",
  correctAnswer: "0",
  explanation: "",
  sortOrder: "0",
};

function lessonToForm(lesson?: AdminLesson | null): LessonForm {
  if (!lesson) return emptyLessonForm;
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    content: lesson.content,
    category: lesson.category,
    estimatedMinutes: String(lesson.estimatedMinutes ?? 3),
    xpReward: String(lesson.xpReward ?? 25),
    xnrtReward: String(lesson.xnrtReward ?? "0"),
    passingScore: String(lesson.passingScore ?? 70),
    isActive: Boolean(lesson.isActive),
    isResponsibleUsage: Boolean(lesson.isResponsibleUsage),
    sortOrder: String(lesson.sortOrder ?? 0),
  };
}

function formPayload(form: LessonForm) {
  return {
    slug: form.slug,
    title: form.title,
    summary: form.summary,
    content: form.content,
    category: form.category,
    estimatedMinutes: Number(form.estimatedMinutes || 3),
    xpReward: Number(form.xpReward || 0),
    xnrtReward: Number(form.xnrtReward || 0),
    passingScore: Number(form.passingScore || 70),
    isActive: form.isActive,
    isResponsibleUsage: form.isResponsibleUsage,
    sortOrder: Number(form.sortOrder || 0),
  };
}

function questionPayload(form: QuestionForm) {
  return {
    question: form.question,
    options: form.optionsText.split("\n").map((item) => item.trim()).filter(Boolean),
    correctAnswer: Number(form.correctAnswer || 0),
    explanation: form.explanation,
    sortOrder: Number(form.sortOrder || 0),
  };
}

export default function LearnEarnTab() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLessonForm);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);

  const { data: lessons = [], isLoading } = useQuery<AdminLesson[]>({ queryKey: ["/api/admin/learn/lessons"] });
  const selectedLesson = useMemo(() => lessons.find((lesson) => lesson.id === selectedId) || lessons[0] || null, [lessons, selectedId]);

  useEffect(() => {
    if (!selectedId && lessons[0]) setSelectedId(lessons[0].id);
  }, [lessons, selectedId]);

  useEffect(() => {
    setLessonForm(lessonToForm(selectedLesson));
    setQuestionForm(emptyQuestionForm);
  }, [selectedLesson?.id]);

  const saveLessonMutation = useMutation({
    mutationFn: async () => {
      const method = lessonForm.id ? "PATCH" : "POST";
      const url = lessonForm.id ? `/api/admin/learn/lessons/${lessonForm.id}` : "/api/admin/learn/lessons";
      const response = await apiRequest(method, url, formPayload(lessonForm));
      return response.json() as Promise<AdminLesson>;
    },
    onSuccess: (lesson) => {
      toast({ title: "Lesson saved", description: `${lesson.title} is ready for Learn & Earn.` });
      setSelectedId(lesson.id);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/learn/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/lessons"] });
    },
    onError: (error: Error) => toast({ title: "Lesson save failed", description: error.message, variant: "destructive" }),
  });

  const addQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLesson) throw new Error("Select a lesson first");
      const response = await apiRequest("POST", `/api/admin/learn/lessons/${selectedLesson.id}/questions`, questionPayload(questionForm));
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Question saved", description: "Quiz question added to the lesson." });
      setQuestionForm(emptyQuestionForm);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/learn/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/lessons"] });
    },
    onError: (error: Error) => toast({ title: "Question save failed", description: error.message, variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/learn/questions/${questionId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Question deleted", description: "Quiz question removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/learn/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learn/lessons"] });
    },
    onError: (error: Error) => toast({ title: "Delete failed", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary" className="mb-2 gap-1"><GraduationCap className="h-3.5 w-3.5" /> Learn & Earn</Badge>
          <h2 className="text-2xl font-bold">Admin Quiz Manager</h2>
          <p className="text-sm text-muted-foreground">Create lessons, manage quizzes, control XP/XNRT rewards, and keep the responsible usage lesson active.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/learn/lessons"] })} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>{lessons.length} lessons configured</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="secondary" className="w-full gap-2" onClick={() => { setSelectedId(null); setLessonForm(emptyLessonForm); }}>
              <Plus className="h-4 w-4" /> New Lesson
            </Button>
            {isLoading && <p className="text-sm text-muted-foreground">Loading lessons…</p>}
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setSelectedId(lesson.id)}
                className={`w-full rounded-xl border p-3 text-left transition hover:bg-primary/5 ${selectedLesson?.id === lesson.id ? "border-primary bg-primary/10" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{lesson.title}</p>
                    <p className="text-xs text-muted-foreground">{lesson.questions?.length || 0} questions · {lesson.completions || 0} attempts</p>
                  </div>
                  {lesson.isResponsibleUsage ? <ShieldCheck className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={lesson.isActive ? "default" : "outline"}>{lesson.isActive ? "Active" : "Inactive"}</Badge>
                  <Badge variant="secondary">+{lesson.xpReward} XP</Badge>
                  <Badge variant="secondary">+{lesson.xnrtReward} XNRT</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{lessonForm.id ? "Edit Lesson" : "Create Lesson"}</CardTitle>
              <CardDescription>Lessons power the user-facing Learn & Earn page.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <Field label="Title"><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></Field>
              <Field label="Slug"><Input value={lessonForm.slug} onChange={(e) => setLessonForm({ ...lessonForm, slug: e.target.value })} placeholder="auto-generated-if-empty" /></Field>
              <Field label="Summary" className="lg:col-span-2"><Input value={lessonForm.summary} onChange={(e) => setLessonForm({ ...lessonForm, summary: e.target.value })} /></Field>
              <Field label="Content" className="lg:col-span-2"><Textarea rows={6} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} /></Field>
              <Field label="Category">
                <Select value={lessonForm.category} onValueChange={(value) => setLessonForm({ ...lessonForm, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responsible_usage">Responsible Usage</SelectItem>
                    <SelectItem value="xnrt_basics">XNRT Basics</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="staking">Staking</SelectItem>
                    <SelectItem value="trust_loan">Trust Loan</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estimated Minutes"><Input type="number" value={lessonForm.estimatedMinutes} onChange={(e) => setLessonForm({ ...lessonForm, estimatedMinutes: e.target.value })} /></Field>
              <Field label="XP Reward"><Input type="number" value={lessonForm.xpReward} onChange={(e) => setLessonForm({ ...lessonForm, xpReward: e.target.value })} /></Field>
              <Field label="XNRT Reward"><Input type="number" value={lessonForm.xnrtReward} onChange={(e) => setLessonForm({ ...lessonForm, xnrtReward: e.target.value })} /></Field>
              <Field label="Passing Score %"><Input type="number" value={lessonForm.passingScore} onChange={(e) => setLessonForm({ ...lessonForm, passingScore: e.target.value })} /></Field>
              <Field label="Sort Order"><Input type="number" value={lessonForm.sortOrder} onChange={(e) => setLessonForm({ ...lessonForm, sortOrder: e.target.value })} /></Field>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Active</Label>
                <Switch checked={lessonForm.isActive} onCheckedChange={(value) => setLessonForm({ ...lessonForm, isActive: value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Responsible Usage Lesson</Label>
                <Switch checked={lessonForm.isResponsibleUsage} onCheckedChange={(value) => setLessonForm({ ...lessonForm, isResponsibleUsage: value })} />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <Button onClick={() => saveLessonMutation.mutate()} disabled={saveLessonMutation.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> {saveLessonMutation.isPending ? "Saving…" : "Save Lesson"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quiz Questions</CardTitle>
              <CardDescription>Add 3–5 MCQs per lesson. Correct answer uses zero-based option index.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedLesson?.questions?.map((question, index) => (
                <div key={question.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{index + 1}. {question.question}</p>
                      <p className="text-xs text-muted-foreground">Correct answer: option {Number(question.correctAnswer) + 1}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteQuestionMutation.mutate(question.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    {question.options.map((option, optionIndex) => <span key={`${question.id}-${optionIndex}`}>{optionIndex + 1}. {option}</span>)}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border bg-muted/20 p-4">
                <h3 className="font-semibold">Add Question</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Field label="Question" className="lg:col-span-2"><Textarea rows={2} value={questionForm.question} onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })} /></Field>
                  <Field label="Options (one per line)" className="lg:col-span-2"><Textarea rows={4} value={questionForm.optionsText} onChange={(e) => setQuestionForm({ ...questionForm, optionsText: e.target.value })} /></Field>
                  <Field label="Correct Answer Index"><Input type="number" value={questionForm.correctAnswer} onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })} /></Field>
                  <Field label="Sort Order"><Input type="number" value={questionForm.sortOrder} onChange={(e) => setQuestionForm({ ...questionForm, sortOrder: e.target.value })} /></Field>
                  <Field label="Explanation" className="lg:col-span-2"><Textarea rows={2} value={questionForm.explanation} onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} /></Field>
                  <div className="lg:col-span-2 flex justify-end">
                    <Button onClick={() => addQuestionMutation.mutate()} disabled={!selectedLesson || addQuestionMutation.isPending} className="gap-2">
                      <Plus className="h-4 w-4" /> {addQuestionMutation.isPending ? "Adding…" : "Add Question"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
