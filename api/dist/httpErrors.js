export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export function asHttpError(err) {
    if (err instanceof HttpError)
        return err;
    return new HttpError(500, "Internal Server Error");
}
