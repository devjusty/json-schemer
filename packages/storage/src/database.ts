import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "./schema";

export function createDatabase(filename: string): DatabaseSync {
  const database = new DatabaseSync(filename);
  database.exec(SCHEMA_SQL);
  return database;
}
