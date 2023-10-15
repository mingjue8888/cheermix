import joi from "joi"

interface ProcessEnvironment {
  NODE_ENV: "development" | string

  DB_CLIENT: string
  DB_HOST: string
  DB_NAME: string
  DB_USERNAME: string
  DB_PASSWORD: string
  DB_POOLSIZE_MIN: number
  DB_POOLSIZE_MAX: number
}

export const {
  NODE_ENV,

  DB_CLIENT,
  DB_HOST,
  DB_NAME,
  DB_USERNAME,
  DB_PASSWORD,
  DB_POOLSIZE_MIN,
  DB_POOLSIZE_MAX,
} = joi.attempt<joi.ObjectSchema<ProcessEnvironment>>(
  process.env,
  joi.object({
    NODE_ENV: joi.string().default("development"),

    DB_CLIENT: joi.string().default("pg"),
    DB_HOST: joi.string().required(),
    DB_NAME: joi.string().required(),
    DB_USERNAME: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    DB_POOLSIZE_MIN: joi.number().integer().greater(1).default(5),
    DB_POOLSIZE_MAX: joi.number().integer().greater(2).default(20),
  }),
  {
    allowUnknown: true,
  }
)
