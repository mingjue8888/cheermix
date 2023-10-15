import joi from "joi"

interface ProcessEnvironment {
  NODE_PORT: number

  EXPRESS_REQUEST_LIMIT_TIMEFRAME: number
  EXPRESS_REQUEST_LIMIT_MAX: number

  JWT_SECRET: string
  JWT_EXPIRES: number
  JWT_REFRESH_TIME: number
}

export const {
  NODE_PORT,

  EXPRESS_REQUEST_LIMIT_TIMEFRAME,
  EXPRESS_REQUEST_LIMIT_MAX,

  JWT_SECRET,
  JWT_EXPIRES,
  JWT_REFRESH_TIME,
} = joi.attempt<joi.ObjectSchema<ProcessEnvironment>>(
  process.env,
  joi.object({
    NODE_PORT: joi.number().integer().default(80),

    EXPRESS_REQUEST_LIMIT_TIMEFRAME: joi.number().integer().default(1000),
    EXPRESS_REQUEST_LIMIT_MAX: joi.number().integer().default(20),

    JWT_SECRET: joi.string().default("hello world!"),
    JWT_EXPIRES: joi
      .number()
      .integer()
      .default(1000 * 60 * 60 * 48),
    JWT_REFRESH_TIME: joi
      .number()
      .integer()
      .default(1000 * 60 * 60),
  }),
  {
    allowUnknown: true,
  }
)
