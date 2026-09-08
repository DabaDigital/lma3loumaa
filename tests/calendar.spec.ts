import { test, expect } from "@playwright/test";
import { makeVisitCalendar, restaurantTimeToUtc } from "../src/calendar";
test("calendar preserves Casablanca local time and valid UTF-8 folded lines", () => {
  const utc = restaurantTimeToUtc("2026-09-10", "19:00");
  expect(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
    }).format(utc),
  ).toBe("19:00");
  const ics = makeVisitCalendar({
    date: "2026-09-10",
    time: "19:00",
    title: "شاورما المعلومة",
    address: "Casablanca",
    description: "تذكير شخصي، وليس حجزاً. ".repeat(10),
    url: "https://example.com/",
  });
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("DTSTART:20260910T180000Z");
  expect(ics).toContain("DTEND:20260910T190000Z");
  expect(
    ics
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBeTruthy();
  expect(ics.replace(/\r\n /g, "")).toContain("تذكير شخصي");
});
