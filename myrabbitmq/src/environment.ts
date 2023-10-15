import joi from "joi"

interface ProcessEnvironment {
  MQ_URL: string
  MQ_PREFETCH: number
}

export const { MQ_URL, MQ_PREFETCH } = joi.attempt<joi.ObjectSchema<ProcessEnvironment>>(
  process.env,
  joi.object({
    MQ_URL: joi.string(),
    MQ_PREFETCH: joi.number().integer().greater(0).default(1),
  }),
  {
    allowUnknown: true,
  }
)
