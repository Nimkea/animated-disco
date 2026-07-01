import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Check, Coins, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { nf } from "@/lib/number";

interface CheckInEntry {
  id: string;
  checkinDate: string;
  streakDay: number;
  xpReward: number;
  xnrtReward: number;
  requestedXnrtReward: number;
  rewardCapped: boolean;
  createdAt: string | Date | null;
}

interface CheckInHistoryResponse {
  dates: string[];
  entries?: CheckInEntry[];
  year: number;
  month: number;
  monthTotalXp?: number;
  monthTotalXnrt?: number;
  currentStreak?: number;
  checkedInToday?: boolean;
  nextReward?: { xnrtReward: number; xpReward: number };
}

export function CheckInCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: checkinHistory } = useQuery<CheckInHistoryResponse>({
    queryKey: ["/api/checkin/history", currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: async () => {
      const response = await fetch(
        `/api/checkin/history?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch check-in history");
      return response.json();
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const checkinDates = new Set(checkinHistory?.dates || []);
  const entryByDate = new Map<string, CheckInEntry>(
    (checkinHistory?.entries || []).map((entry) => [entry.checkinDate, entry])
  );

  const isCheckedIn = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return checkinDates.has(dateStr);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const isCurrentMonth = isSameDay(startOfMonth(currentDate), startOfMonth(new Date()));
  const currentStreak = checkinHistory?.currentStreak ?? user?.streak ?? 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-500" />
              Check-In Calendar
            </CardTitle>
            <CardDescription>Each highlighted day is locked by the server-side daily check-in ledger.</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit font-mono text-lg" data-testid="text-current-streak">
            <Flame className="h-4 w-4 mr-1 text-amber-500" />
            {nf(currentStreak)} Day Streak
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-4 w-4" /> Month check-ins</div>
            <p className="mt-1 font-mono text-2xl font-bold">{nf(checkinHistory?.dates?.length ?? 0)}</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="h-4 w-4" /> Month XNRT</div>
            <p className="mt-1 font-mono text-2xl font-bold">{nf(checkinHistory?.monthTotalXnrt ?? 0)}</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-4 w-4" /> Month XP</div>
            <p className="mt-1 font-mono text-2xl font-bold">{nf(checkinHistory?.monthTotalXp ?? 0)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousMonth}
            data-testid="button-previous-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold" data-testid="text-calendar-month">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            {!isCurrentMonth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                data-testid="button-today"
              >
                Today
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
              data-testid={`text-weekday-${day.toLowerCase()}`}
            >
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            const isCurrentDay = isToday(day);
            const isInCurrentMonth = day.getMonth() === currentDate.getMonth();
            const hasCheckedIn = isCheckedIn(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const entry = entryByDate.get(dateStr);

            return (
              <div
                key={index}
                title={entry ? `Day ${entry.streakDay}: +${entry.xpReward} XP, +${entry.xnrtReward} XNRT` : undefined}
                className={`
                  aspect-square p-2 rounded-md text-center relative
                  ${!isInCurrentMonth ? "text-muted-foreground/30" : ""}
                  ${isCurrentDay ? "ring-2 ring-primary" : ""}
                  ${hasCheckedIn && isInCurrentMonth
                    ? "bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-500/50"
                    : "border border-border"
                  }
                `}
                data-testid={`calendar-day-${dateStr}`}
              >
                <div className={`
                  text-sm font-medium
                  ${isCurrentDay ? "text-primary font-bold" : ""}
                  ${hasCheckedIn && isInCurrentMonth ? "text-amber-600 dark:text-amber-400" : ""}
                `}>
                  {format(day, "d")}
                </div>
                {hasCheckedIn && isInCurrentMonth && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-5 w-5 text-amber-500" data-testid={`icon-check-${dateStr}`} />
                  </div>
                )}
                {entry?.rewardCapped && (
                  <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-destructive" aria-label="Reward cap applied" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-500/50" />
            <span className="text-sm text-muted-foreground">Checked In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-2 ring-primary" />
            <span className="text-sm text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Cap applied</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
