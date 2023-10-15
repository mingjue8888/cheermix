export abstract class HttpServerException extends Error {
  abstract getHttpResponseStatusCode(): number
}

export class WrongParameterException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 400
  }
}

export class NotFoundException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 404
  }
}

export class UnauthorizedException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 401
  }
}

export class NoPermissionException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 403
  }
}

export class ServerErrorException extends HttpServerException {
  getHttpResponseStatusCode(): number {
    return 500
  }
}
