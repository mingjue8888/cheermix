import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import quarterOfYear from "dayjs/plugin/quarterOfYear"
import weekOfYear from "dayjs/plugin/weekOfYear"
import { NODE_TIMEZONE } from "./environment"
import "dayjs/plugin/utc"
import "dayjs/plugin/timezone"
import "dayjs/plugin/quarterOfYear"
import "dayjs/plugin/weekOfYear"

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(quarterOfYear)
dayjs.extend(weekOfYear)

dayjs.tz.setDefault(NODE_TIMEZONE)

export function getUnixTimestamp(addSeconds: number): number {
  const nodeTimestamp = dayjs().tz().add(addSeconds, "second").toDate().getTime()
  return Math.floor(nodeTimestamp / 1000)
}

export default dayjs
