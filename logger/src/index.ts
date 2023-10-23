import joi from "joi"
import dayjs from "@cheermix/timeutil"
import winston from "winston"

interface ProcessEnvironment {
  LOGGER_LEVEL: "error" | "warn" | "info" | "http" | "debug"
  LOGGER_COLORIZE: boolean
  LOGGER_TEXT_ALIGN: boolean
  LOGGER_TIME_FORMAT: string
}

export const { LOGGER_LEVEL, LOGGER_COLORIZE, LOGGER_TEXT_ALIGN, LOGGER_TIME_FORMAT } = joi.attempt<
  joi.ObjectSchema<ProcessEnvironment>
>(
  process.env,
  joi.object({
    LOGGER_LEVEL: joi.string().allow("error", "warn", "info", "http", "debug").default("debug"),
    LOGGER_COLORIZE: joi.boolean().default(true),
    LOGGER_TEXT_ALIGN: joi.boolean().default(true),
    LOGGER_TIME_FORMAT: joi.string().default("YYYY-MM-DD HH:mm:ss.SSS"),
  }),
  {
    allowUnknown: true,
  }
)

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
