/*
Usage:
var ago = require('s-ago');
var now = new Date();
var yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
var hoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
ago(now); // 'just now'
ago(yesterday); // 'yesterday'
ago(hoursAgo); // '6 hours ago'
*/
function format(diff, divisor, unit, past, future, isInTheFuture) {
  const val = Math.round(Math.abs(diff) / divisor);
  if (isInTheFuture) return val <= 1 ? future : val + " " + unit + " left";
  return val <= 1 ? past : val + " " + unit + " ago";
}
const units = [
  {
    max: 2760000,
    value: 60000,
    name: "minutes",
    past: "1 minutes ago",
    future: "in 1 minutes"
  },
  {
    max: 72000000,
    value: 3600000,
    name: "hours",
    past: "1 hours ago",
    future: "in 1 hours"
  },
  {
    max: 518400000,
    value: 86400000,
    name: "hari",
    past: "yesterday",
    future: "tomorrow"
  },
  {
    max: 2419200000,
    value: 604800000,
    name: "week",
    past: "last week",
    future: "next week"
  },
  {
    max: 28512000000,
    value: 2592000000,
    name: "month",
    past: "last month",
    future: "next month"
  } // max: 11 months
];
export default function ago(date, max) {
  const diff = Date.now() - date.getTime();
  // less than a minute
  if (Math.abs(diff) < 60000) return "just now";
  for (var i = 0; i < units.length; i++) {
    if (Math.abs(diff) < units[i].max || (max && units[i].name === max)) {
      return format(
        diff,
        units[i].value,
        units[i].name,
        units[i].past,
        units[i].future,
        diff < 0
      );
    }
  }
  return format(
    diff,
    31536000000,
    "year",
    "last year",
    "next year",
    diff < 0
  );
}
