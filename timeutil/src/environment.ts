import joi from "joi"

interface ProcessEnvironment {
  NODE_TIMEZONE: string
}

export const { NODE_TIMEZONE } = joi.attempt<joi.ObjectSchema<ProcessEnvironment>>(
  process.env,
  joi.object({
    NODE_TIMEZONE: joi.string().default("Asia/Hong_Kong"),
  })
)
