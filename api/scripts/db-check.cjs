/* eslint-disable no-console */

const Database = require("better-sqlite3");

const fileId = process.argv[2];
if (!fileId) {
  console.error("Usage: node scripts/db-check.cjs <fileUploadId>");
  process.exit(2);
}

const db = new Database("dev.db", { readonly: true });

const file = db
  .prepare("select id, patientId, originalName, storagePath from FileUpload where id = ?")
  .get(fileId);

const refs = db
  .prepare("select shareRequestId, fileUploadId from ShareRequestFile where fileUploadId = ?")
  .all(fileId);

const firstRequestId = refs[0]?.shareRequestId;
const firstRequest = firstRequestId
  ? db
      .prepare("select id, patientId, doctorId, message, createdAt from ShareRequest where id = ?")
      .get(firstRequestId)
  : null;

console.log({ file, refsCount: refs.length, refs: refs.slice(0, 5), firstRequest });
