import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Coins, Flame, Gauge, Save, Settings2, Sparkles, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EngagementConfig {
  enabled: boolean;
  levelXpStep: number;
  dailyTotalXnrtCap: number;
  weeklyTotalXnrtCap: number;
  dailyTaskXnrtCap: number;
  weeklyTaskXnrtCap: number;
  dailyCheckinBaseXnrt: number;
  dailyCheckinStreakBonusXnrt: number;
  dailyCheckinMaxXnrt: number;
  dailyCheckinBaseXp: number;
  dailyCheckinStreakBonusXp: number;
  dailyCheckinMaxXp: number;
  taskCompletionXpDailyCap: number;
  updatedBy?: string | null;
  updatedAt?: string | Date | null;
}

interface AdminEngagementSummary {
  config: EngagementConfig;
  metrics: {
    activeTasks: number;
    completedTasksToday: number;
    xpAwardedToday: number;
    xpEventsToday: number;
    xnrtRewardsToday: number;
    xnrtRewardEventsToday: number;
  };
  levelDistribution: Array<{ level: number; users: number }>;
  recentXp: Array<{
    id: string;
    username: string;
    amount: number;
    source: string;
    reason: string;
    levelBefore: number;
    levelAfter: number;
    createdAt: string | Date;
  }>;
}

type FormState = Record<keyof Omit<EngagementConfig, "updatedBy" | "updatedAt">, string | boolean>;

const DEFAULT_FORM: FormState = {
  enabled: true,
  levelXpStep: "1000",
  dailyTotalXnrtCap: "200",
  weeklyTotalXnrtCap: "1000",
  dailyTaskXnrtCap: "100",
  weeklyTaskXnrtCap: "500",
  dailyCheckinBaseXnrt: "5",
  dailyCheckinStreakBonusXnrt: "2",
  dailyCheckinMaxXnrt: "25",
  dailyCheckinBaseXp: "10",
  dailyCheckinStreakBonusXp: "5",
  dailyCheckinMaxXp: "50",
  taskCompletionXpDailyCap: "500",
};

function numberText(value: number | string | boolean | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";
}

function toForm(config?: EngagementConfig): FormState {
  if (!config) return DEFAULT_FORM;
  return {
    enabled: Boolean(config.enabled),
    levelXpStep: String(config.levelXpStep ?? 1000),
    dailyTotalXnrtCap: String(config.dailyTotalXnrtCap ?? 200),
    weeklyTotalXnrtCap: String(config.weeklyTotalXnrtCap ?? 1000),
    dailyTaskXnrtCap: String(config.dailyTaskXnrtCap ?? 100),
    weeklyTaskXnrtCap: String(config.weeklyTaskXnrtCap ?? 500),
    dailyCheckinBaseXnrt: String(config.dailyCheckinBaseXnrt ?? 5),
    dailyCheckinStreakBonusXnrt: String(config.dailyCheckinStreakBonusXnrt ?? 2),
    dailyCheckinMaxXnrt: String(config.dailyCheckinMaxXnrt ?? 25),
    dailyCheckinBaseXp: String(config.dailyCheckinBaseXp ?? 10),
    dailyCheckinStreakBonusXp: String(config.dailyCheckinStreakBonusXp ?? 5),
    dailyCheckinMaxXp: String(config.dailyCheckinMaxXp ?? 50),
    taskCompletionXpDailyCap: String(config.taskCompletionXpDailyCap ?? 500),
  };
}

function formToPayload(form: FormState) {
  return {
    enabled: Boolean(form.enabled),
    levelXpStep: Number(form.levelXpStep || 1000),
    dailyTotalXnrtCap: Number(form.dailyTotalXnrtCap || 0),
    weeklyTotalXnrtCap: Number(form.weeklyTotalXnrtCap || 0),
    dailyTaskXnrtCap: Number(form.dailyTaskXnrtCap || 0),
    weeklyTaskXnrtCap: Number(form.weeklyTaskXnrtCap || 0),
    dailyCheckinBaseXnrt: Number(form.dailyCheckinBaseXnrt || 0),
    dailyCheckinStreakBonusXnrt: Number(form.dailyCheckinStreakBonusXnrt || 0),
    dailyCheckinMaxXnrt: Number(form.dailyCheckinMaxXnrt || 0),
    dailyCheckinBaseXp: Number(form.dailyCheckinBaseXp || 0),
    dailyCheckinStreakBonusXp: Number(form.dailyCheckinStreakBonusXp || 0),
    dailyCheckinMaxXp: Number(form.dailyCheckinMaxXp || 0),
    taskCompletionXpDailyCap: Number(form.taskCompletionXpDailyCap || 0),
  };
}

function StatCard({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <Card className="premium-stat-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="premium-number text-2xl">{value}</p>
            <p className="text-xs text-muted-foreground">{note}</p>
          </div>
          <div className="premium-icon-bubble">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({ label, name, form, setForm, step = "1", min = "0" }: { label: string; name: keyof FormState; form: FormState; setForm: (next: FormState) => void; step?: string; min?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        value={String(form[name] ?? "")}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
      />
    </div>
  );
}

export default function EngagementConfigTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const { data: summary, isLoading } = useQuery<AdminEngagementSummary>({
    queryKey: ["/api/admin/engagement/summary"],
  });

  useEffect(() => {
    if (summary?.config) setForm(toForm(summary.config));
  }, [summary?.config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", "/api/admin/engagement/config", formToPayload(form));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engagement/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/engagement/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement/summary"] });
      toast({ title: "Engagement settings saved", description: "XP levels and reward caps are now updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save settings", description: error.message, variant: "destructive" });
    },
  });

  const preview = useMemo(() => {
    const config = formToPayload(form);
    return Array.from({ length: 6 }).map((_, index) => {
      const level = index === 0 ? 1 : index * 10;
      return { level, requiredXp: (level - 1) * config.levelXpStep };
    });
  }, [form]);

  const metrics = summary?.metrics;

  return (
    <div className="space-y-6">
      <div className="premium-hero-card rounded-3xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Engagement v1
            </Badge>
            <h2 className="text-2xl font-bold">Engagement Config + XP Levels</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Control level progression, daily/weekly XNRT caps, task reward caps, and daily check-in reward formula from one safe admin panel.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Reward engine</p>
              <p className="font-semibold">{form.enabled ? "Enabled" : "Paused"}</p>
            </div>
            <Switch checked={Boolean(form.enabled)} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="XP Awarded Today" value={numberText(metrics?.xpAwardedToday)} note={`${numberText(metrics?.xpEventsToday)} XP events`} icon={Trophy} />
        <StatCard title="XNRT Rewards Today" value={`${numberText(metrics?.xnrtRewardsToday)} XNRT`} note={`${numberText(metrics?.xnrtRewardEventsToday)} reward events`} icon={Coins} />
        <StatCard title="Tasks Completed Today" value={numberText(metrics?.completedTasksToday)} note={`${numberText(metrics?.activeTasks)} active tasks`} icon={Activity} />
        <StatCard title="Level Step" value={`${numberText(form.levelXpStep)} XP`} note="XP needed per level" icon={Gauge} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Reward Caps
            </CardTitle>
            <CardDescription>Hard server-side caps prevent reward farming and inflation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <NumberField label="Daily total XNRT cap" name="dailyTotalXnrtCap" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Weekly total XNRT cap" name="weeklyTotalXnrtCap" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Daily task XNRT cap" name="dailyTaskXnrtCap" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Weekly task XNRT cap" name="weeklyTaskXnrtCap" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Task XP daily cap" name="taskCompletionXpDailyCap" form={form} setForm={setForm} />
            <NumberField label="XP per level" name="levelXpStep" form={form} setForm={setForm} />
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" /> Daily Check-in Formula
            </CardTitle>
            <CardDescription>Used by the daily streak/check-in system.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <NumberField label="Base XNRT" name="dailyCheckinBaseXnrt" form={form} setForm={setForm} step="0.01" />
            <NumberField label="XNRT streak bonus per day" name="dailyCheckinStreakBonusXnrt" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Max daily check-in XNRT" name="dailyCheckinMaxXnrt" form={form} setForm={setForm} step="0.01" />
            <NumberField label="Base XP" name="dailyCheckinBaseXp" form={form} setForm={setForm} />
            <NumberField label="XP streak bonus per day" name="dailyCheckinStreakBonusXp" form={form} setForm={setForm} />
            <NumberField label="Max daily check-in XP" name="dailyCheckinMaxXp" form={form} setForm={setForm} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Level Preview</CardTitle>
            <CardDescription>Simple and predictable: level = total XP divided by configured XP step.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Required Total XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row) => (
                  <TableRow key={row.level}>
                    <TableCell>Level {row.level}</TableCell>
                    <TableCell>{numberText(row.requiredXp)} XP</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Recent XP Ledger</CardTitle>
            <CardDescription>Latest XP awards recorded by the server ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading engagement summary…</p>
            ) : summary?.recentXp?.length ? (
              <div className="space-y-2">
                {summary.recentXp.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="premium-list-row flex items-center justify-between gap-3 rounded-2xl p-3">
                    <div>
                      <p className="font-medium">{entry.username}</p>
                      <p className="text-xs text-muted-foreground">{entry.reason} · {entry.source}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-primary">+{entry.amount} XP</p>
                      <p className="text-xs text-muted-foreground">L{entry.levelBefore} → L{entry.levelAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No XP ledger entries yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="premium-action-button">
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Engagement Settings"}
        </Button>
      </div>
    </div>
  );
}
