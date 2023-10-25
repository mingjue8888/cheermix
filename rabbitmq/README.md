## Usage

Combined with rxjs, it allows you to write message queues in a more functional way

```typescript
import joi from "joi"
import {
  batchConsume,
  consume,
  filterOnSchema,
  filterAndAck,
  initQueue,
  publish,
} from "@cheermix/rabbitmq"
import { buffer, filter, map } from "rxjs"
import { maxBy, minBy } from "lodash"

// Demo interface
interface BinanceCandlestickChart {
  coinType: string
  timeFrame: number
  date: string
  open: number
  close: number
  high: number
  low: number
}

// Demo data
const data: BinanceCandlestickChart[] = [
  {
    coinType: "BTC/USDT",
    timeFrame: 300000,
    date: "2022-10-01T00:00:00.000+08:00",
    open: 19756.02,
    close: 19665.06,
    high: 19758.66,
    low: 19601.5,
  },
  {
    coinType: "BTC/USDT",
    timeFrame: 300000,
    date: "2022-10-01T00:05:00.000+08:00",
    open: 19666.74,
    close: 19622.14,
    high: 19700,
    low: 19603.76,
  },
  // ...
]

// Initialize the mq configuration,
// push the five-minute candle chart data,
// and then subscribe to obtain them.
initQueue([
  {
    exchange: "crawler",
    queue: "crawler.FiveMinutesBinanceCandlestickChart",
    routePattern: "FiveMinutesBinanceCandlestickChart",
  },
  {
    exchange: "crawler",
    queue: "crawler.FifteenMinutesBinanceCandlestickChart",
    routePattern: "FifteenMinutesBinanceCandlestickChart",
  },
])
  .then(async function () {
    const pushAll = data.map(x => publish("crawler", "FiveMinutesBinanceCandlestickChart", x))
    await Promise.all(pushAll)
  })
  .then(async function () {
    const any$ = consume("crawler.FiveMinutesBinanceCandlestickChart")

    const candlestickChart$ = any$.pipe(
      filterOnSchema<BinanceCandlestickChart>({
        coinType: joi.string().required(),
        timeFrame: joi.number().integer().required(),
        date: joi.string().required(),
        open: joi.number().required(),
        close: joi.number().required(),
        high: joi.number().required(),
        low: joi.number().required(),
      })
    )

    candlestickChart$.subscribe(function (data) {
      data.exchangeName
      data.routingKey
      data.message // This is BinanceCandlestickChart
      data.ack()
    })
  })

// Assuming that the data in the queue is complete and the time sequence is correct,
// let's synthesize a 15-minute BTC candlestick chart.
// Remember to set MQ_PREFETCH larger, at least greater than 3 here.
async function main() {
  const any$ = consume("crawler.FiveMinutesBinanceCandlestickChart")

  const candlestickChart$ = any$.pipe(
    filterOnSchema<BinanceCandlestickChart>({
      coinType: joi.string().required(),
      timeFrame: joi.number().integer().required(),
      date: joi.string().required(),
      open: joi.number().required(),
      close: joi.number().required(),
      high: joi.number().required(),
      low: joi.number().required(),
    })
  )

  const fiveMinCandlestickChart$ = candlestickChart$.pipe(
    filterAndAck(x => x.message.coinType == "BTC/USDT"),
    filterAndAck(x => x.message.timeFrame == 300000)
  )

  const fifteenMinCandlestickChart$ = fiveMinCandlestickChart$.pipe(
    buffer(3),
    map(messages => ({
      message: {
        coinType: messages[0].message.coinType,
        timeFrame: messages[0].message.timeFrame * 3,
        date: messages[0].message.date,
        open: messages[0].message.open,
        close: messages[2].message.close,
        high: maxBy(messages, x => x.message.high),
        low: minBy(messages, x => x.message.low),
      },
      ackAll: () => messages.forEach(m => m.ack()),
    }))
  )

  fifteenMinCandlestickChart$.subscribe(function (data) {
    publish("crawler", "FifteenMinutesBinanceCandlestickChart", data.message)
    data.ackAll()
  })
}
```

## Environment

| Name        | Type   | Default Value | Is Require? | Description   |
| ----------- | ------ | ------------- | ----------- | ------------- |
| MQ_URL      | string |               | yes         | Connect URL   |
| MQ_PREFETCH | number | 1             | no          | Consume limit |
