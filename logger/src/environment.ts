import joi from "joi"

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
