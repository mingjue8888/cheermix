## Usage

This library is based on dayjs and supports timezone

```typescript
import dayjs from "@cheermix/timeutil"

dayjs()
  .tz()
  .add(1, "year")
  .add(-6, "months")
  .add(3, "weeks")
  .add(-10, "days")
  .format("YYYY-MM-DD HH:mm:ss.SSS")
```

## Environment

| Name          | Type   | Default Value  | Description    |
| ------------- | ------ | -------------- | -------------- |
| NODE_TIMEZONE | string | Asia/Hong_Kong | Dayjs timezone |
