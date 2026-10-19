import type { FieldValue, Timestamp } from "firebase/firestore";

/** 쓰기용 타입: Timestamp 필드에 serverTimestamp() 를 넣을 수 있게 한다 */
export type Writable<T> = {
  [K in keyof T]: T[K] extends Timestamp ? Timestamp | FieldValue : T[K];
};

export const SCHEMA_VERSION = 1;
