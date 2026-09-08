/** Resolve restaurant-local time using the browser's IANA timezone database. */
export function restaurantTimeToUtc(date: string, time: string) {
  const local = Date.parse(`${date}T${time}:00Z`);
  let result = local;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Casablanca",
    timeZoneName: "shortOffset",
  });
  for (let pass = 0; pass < 3; pass++) {
    const offset =
      formatter
        .formatToParts(new Date(result))
        .find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const minutes = match
      ? (Number(match[2]) * 60 + Number(match[3] || 0)) *
        (match[1] === "+" ? 1 : -1)
      : 0;
    result = local - minutes * 60_000;
  }
  return new Date(result);
}
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
// RFC 5545 folding counts UTF-8 octets, including Arabic characters.
function fold(line: string) {
  let output = "",
    part = "",
    bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 74) {
      output += part + "\r\n";
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  return output + part;
}
export function makeVisitCalendar({
  date,
  time,
  title,
  address,
  description,
  url,
}: {
  date: string;
  time: string;
  title: string;
  address: string;
  description: string;
  url: string;
}) {
  const start = restaurantTimeToUtc(date, time);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lma3louma//Visit Reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@lma3louma.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + 60 * 60_000))}`,
    `SUMMARY:${escape(title)}`,
    `LOCATION:${escape(address)}`,
    `DESCRIPTION:${escape(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
