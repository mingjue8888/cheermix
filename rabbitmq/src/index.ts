import amqp from "amqplib"
import { MQ_PREFETCH, MQ_URL } from "./environment"
import { Observable, Subscriber, bufferTime, filter, map } from "rxjs"
import _ from "lodash"
import joi from "joi"

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

export function consume<T>(queue: string, schema: joi.ObjectSchema<T>) {
  const message$ = new Observable(function (
    observer: Subscriber<{ msg: amqp.ConsumeMessage; channel: amqp.Channel }>
  ) {
    getAliveChannel()
      .then(channel => channel.prefetch(MQ_PREFETCH).then(() => channel))
      .then(channel => channel.consume(queue, msg => msg && observer.next({ msg, channel })))
  })

  return message$.pipe(
    map(param => ({
      exchangeName: param.msg.fields.exchange,
      routingKey: param.msg.fields.routingKey,
      message: JSON.parse(param.msg.content.toString("utf-8")) as T,
      ack: () => param.channel.ack(param.msg),
    })),
    filter(x => {
      try {
        x.message = joi.attempt(x.message, schema, {
          allowUnknown: true,
        })
        return true
      } catch (error) {
        const errorMessage = {
          errorType: "JoiValidationError",
          errorMessage: error.message,
          exchangeName: x.exchangeName,
          routingKey: x.routingKey,
          message: x.message,
        }
        publish("errors", "JoiValidationError", errorMessage).then(() => x.ack())
        return false
      }
    })
  )
}

interface BatchConsumeOptions {
  bufferTimeSpan: number
  bufferCreationInterval: number
}

export function batchConsume<T>(
  queue: string,
  schema: joi.ObjectSchema<T>,
  options: BatchConsumeOptions = { bufferTimeSpan: 200, bufferCreationInterval: 200 }
) {
  return consume<T>(queue, schema).pipe(
    bufferTime(options.bufferTimeSpan, options.bufferCreationInterval),
    filter(xs => xs.length > 0),
    map(messages => ({
      messages,
      ackAll: () => Promise.all(messages.map(m => m.ack())),
    }))
  )
}
