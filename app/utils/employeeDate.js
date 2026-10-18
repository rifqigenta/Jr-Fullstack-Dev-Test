export function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function displayDate(value) {
  if (!value) return "";

  const text = String(value).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

export function parseDisplayDate(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(0);

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));

  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function calculateAge(isoDate) {
  if (!isoDate || isoDate > jakartaToday()) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = jakartaToday().split("-").map(Number);

  let age = currentYear - year;

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  return age;
}
