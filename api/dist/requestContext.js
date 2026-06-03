import { HttpError } from "./httpErrors.js";
export function getUserId(req) {
    const userId = req.header("x-user-id")?.trim();
    if (!userId) {
        throw new HttpError(401, "Missing x-user-id header (prototype auth)");
    }
    return userId;
}
