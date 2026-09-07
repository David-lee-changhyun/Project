import { customAlphabet } from "nanoid";

// URL-safe, 대소문자+숫자, 21자리 (nanoid 기본과 동일 충돌확률)
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21
);

export function newId(prefix?: string): string {
  return prefix ? `${prefix}_${nanoid()}` : nanoid();
}
