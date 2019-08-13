function dateTime(date = new Date()){
  const padNum = num => num.toString().padStart(2, 0);
  const dateStr = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(padNum).join('-');
  const timeStr = [date.getHours(), date.getMinutes(), date.getSeconds()].map(padNum).join(':');
  return `${dateStr} ${timeStr}`;
}

function log(botname, ...args) {
  console.log('%s', `[log][${dateTime()}][${botname}]`, ...args);
}

function info(botname, ...args) {
  console.info('%c%s', 'color:#3498db', `[info][${dateTime()}][${botname}]`, ...args);
}

function debug(botname, ...args) {
  console.debug('%c%s', 'color:#7f8c8d', `[debug][${dateTime()}][${botname}]`, ...args);
}

function warn(botname, ...args) {
  console.warn('%c%s', 'color:#f39c12', `[warn][${dateTime()}][${botname}]`, ...args);
}

function error(botname, ...args) {
  console.error('%c%s', 'color:#e74c3c', `[error][${dateTime()}][${botname}]`, ...args);
}

module.exports = {
  dateTime,
  log,
  info,
  debug,
  warn,
  error,
};