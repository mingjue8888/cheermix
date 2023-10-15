import dayjs from "@cheermix/timeutil"
import winston from "winston"
import { LOGGER_COLORIZE, LOGGER_LEVEL, LOGGER_TEXT_ALIGN, LOGGER_TIME_FORMAT } from "./environment"

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
}

winston.addColors(colors)

const logFormats: winston.Logform.Format[] = []

logFormats.push(winston.format.timestamp({ format: () => dayjs().tz().format(LOGGER_TIME_FORMAT) }))

if (LOGGER_COLORIZE) {
  logFormats.push(winston.format.colorize({ all: true }))
}

if (LOGGER_TEXT_ALIGN) {
  logFormats.push(winston.format.align())
}

logFormats.push(
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message?.toString()}`)
)

export default winston.createLogger({
  level: LOGGER_LEVEL,
  levels,
  format: winston.format.combine(...logFormats),
  transports: [new winston.transports.Console()],
})
