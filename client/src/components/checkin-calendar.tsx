import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface CheckInHistoryResponse {
  dates: string[];
  year: number;
  month: number;
}

export function CheckInCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: checkinHistory } = useQuery<CheckInHistoryResponse>({
    queryKey: ["/api/checkin/history", currentDate.getFullYear(), currentDate.getMonth()],
    queryFn: async () => {
      const response = await fetch(
        `/api/checkin/history?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}`
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

  const isCheckedIn = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
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

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            Check-In Calendar
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-lg" data-testid="text-current-streak">
            <Flame className="h-4 w-4 mr-1 text-amber-500" />
            {user?.streak || 0} Day Streak
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              {format(currentDate, 'MMMM yyyy')}
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
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
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
            const dateStr = format(day, 'yyyy-MM-dd');

            return (
              <div
                key={index}
                className={`
                  aspect-square p-2 rounded-md text-center relative
                  ${!isInCurrentMonth ? 'text-muted-foreground/30' : ''}
                  ${isCurrentDay ? 'ring-2 ring-primary' : ''}
                  ${hasCheckedIn && isInCurrentMonth
                    ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-500/50'
                    : 'border border-border'
                  }
                `}
                data-testid={`calendar-day-${dateStr}`}
              >
                <div className={`
                  text-sm font-medium
                  ${isCurrentDay ? 'text-primary font-bold' : ''}
                  ${hasCheckedIn && isInCurrentMonth ? 'text-amber-600 dark:text-amber-400' : ''}
                `}>
                  {format(day, 'd')}
                </div>
                {hasCheckedIn && isInCurrentMonth && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-5 w-5 text-amber-500" data-testid={`icon-check-${dateStr}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-500/50" />
            <span className="text-sm text-muted-foreground">Checked In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded ring-2 ring-primary" />
            <span className="text-sm text-muted-foreground">Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
