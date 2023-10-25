import amqp from "amqplib"
import { Observable, Subscriber, map } from "rxjs"
import _ from "lodash"
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

export async function getAliveChannel(): Promise<amqp.Channel> {
  return amqp
    .connect(MQ_URL)
    .then(connection => connection.createChannel())
    .then(channel => channel.prefetch(MQ_PREFETCH).then(() => channel))
}

export async function autoCloseChannel<T>(
  channelHandler: (channel: amqp.Channel, connection: amqp.Connection) => Promise<T>
) {
  const connection = await amqp.connect(MQ_URL)
  const channel = await connection.createChannel()
  const result = await channelHandler(channel, connection)
  await channel.close()
  await connection.close()
  return result
}

interface BindQueueConfig {
  exchange: string
  queue: string
  routePattern: string
}

export async function initQueue(binds: BindQueueConfig[]) {
  binds.push({
    exchange: "errors",
    queue: "errors.JoiValidationError",
    routePattern: "JoiValidationError",
  })

  await autoCloseChannel(async function (channel) {
    const createExchangePromises = _(binds)
      .map(x => x.exchange)
      .uniq()
      .value()
      .map(s => channel.assertExchange(s, "topic"))

    const createQueuePromises = _(binds)
      .map(x => x.queue)
      .uniq()
      .value()
      .map(s => channel.assertQueue(s, { durable: true }))

    await Promise.all([...createExchangePromises, ...createQueuePromises])

    const bindQueuePromises = binds.map(x => channel.bindQueue(x.queue, x.exchange, x.routePattern))
    await Promise.all(bindQueuePromises)
  })
}

export async function sendToQueue(queue: string, message: object, priority?: number) {
  return autoCloseChannel(async function (channel) {
    const jsonstring = JSON.stringify(message)
    const buffer = Buffer.from(jsonstring, "utf-8")
    return channel.sendToQueue(queue, buffer, { priority })
  })
}

export async function publish(
  exchange: string,
  routingKey: string,
  message: object,
  priority?: number
) {
  return autoCloseChannel(async function (channel) {
    const jsonstring = JSON.stringify(message)
    const buffer = Buffer.from(jsonstring, "utf-8")
    return channel.publish(exchange, routingKey, buffer, { priority })
  })
}

export interface ConsumeMessage<T> {
  exchangeName: string
  queueName: string
  routingKey: string
  message: T
  ack: () => void
}

export function consume(queue: string) {
  const message$ = new Observable(function (
    observer: Subscriber<{ msg: amqp.ConsumeMessage; channel: amqp.Channel }>
  ) {
    getAliveChannel()
      .then(channel => channel.prefetch(MQ_PREFETCH).then(() => channel))
      .then(channel => channel.consume(queue, msg => msg && observer.next({ msg, channel })))
  })

  return message$.pipe(
    map(
      param =>
        ({
          exchangeName: param.msg.fields.exchange,
          queueName: queue,
          routingKey: param.msg.fields.routingKey,
          message: JSON.parse(param.msg.content.toString("utf-8")) as any,
          ack: () => param.channel.ack(param.msg),
        } as ConsumeMessage<any>)
    )
  )
}

export function filterOnSchema<T>(joiSchema: Record<string, joi.AnySchema>) {
  return function (observable: Observable<ConsumeMessage<T>>) {
    return new Observable<ConsumeMessage<T>>(function (subscriber) {
      observable.subscribe(function (message) {
        try {
          message.message = joi.attempt(message.message, joi.object(joiSchema), {
            allowUnknown: true,
          })
          subscriber.next(message)
        } catch (error) {
          const errorMessage = {
            errorType: "JoiValidationError",
            errorMessage: error.message,
            ...message,
          }
          publish("errors", "JoiValidationError", errorMessage).then(() => message.ack())
        }
      })
    })
  }
}

export function filterAndAck<T>(filterFunction: (message: ConsumeMessage<T>) => boolean) {
  return function (observable: Observable<ConsumeMessage<T>>) {
    return new Observable<ConsumeMessage<T>>(function (subscriber) {
      observable.subscribe(function (message) {
        if (filterFunction(message)) {
          subscriber.next(message)
        } else {
          message.ack()
        }
      })
    })
  }
}
