const DAILY_KEY = "arcana-daily";

export type DailyVisit = {
  firstToday: boolean;
  streak: number;
};

type DailyRecord = {
  last: string;
  streak: number;
};

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readRecord(): DailyRecord | null {
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as DailyRecord).last === "string" &&
      typeof (parsed as DailyRecord).streak === "number"
    ) {
      return parsed as DailyRecord;
    }
    return null;
  } catch (error) {
    console.error("Daily record could not be read", error);
    return null;
  }
}

export function recordDailyPage(now = new Date()): DailyVisit {
  const today = dayKey(now);
  const record = readRecord();
  if (record?.last === today) return { firstToday: false, streak: record.streak };

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const streak = record?.last === dayKey(yesterday) ? record.streak + 1 : 1;
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify({ last: today, streak }));
  } catch (error) {
    console.error("Daily record could not be saved", error);
  }
  return { firstToday: true, streak };
}
