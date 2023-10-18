## Usage

A logger that integrates winston and supports timezone for printing time

```typescript
import logger from "@cheermix/logger"

logger.info("info message")
logger.http("http message")
logger.error("error message")
```

## Environment

| Name               | Type                                             | Default Value           | Description              |
| ------------------ | ------------------------------------------------ | ----------------------- | ------------------------ |
| LOGGER_LEVEL       | "error"<br>"warn"<br>"info"<br>"http"<br>"debug" | "debug"                 | Log printing level       |
| LOGGER_COLORIZE    | boolean                                          | true                    | Log coloring             |
| LOGGER_TEXT_ALIGN  | boolean                                          | true                    | Log text format adaptive |
| LOGGER_TIME_FORMAT | string                                           | YYYY-MM-DD HH:mm:ss.SSS | Log time format          |
| NODE_TIMEZONE      | string                                           | Asia/Hong_Kong          | Dayjs timezone           |
