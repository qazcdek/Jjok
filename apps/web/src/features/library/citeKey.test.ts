import { describe, expect, it } from "vitest";
import { makeCiteKey, uniqueCiteKey } from "./citeKey";

describe("makeCiteKey", () => {
  it("성 + 연도 + 제목 첫 단어", () => {
    expect(
      makeCiteKey({
        authors: [{ name: "Ashish Vaswani" }],
        year: 2017,
        title: "Attention Is All You Need",
      }),
    ).toBe("vaswani2017attention");
  });

  it("관사·전치사를 건너뛰고 악센트를 없앤다", () => {
    expect(
      makeCiteKey({
        authors: [{ name: "José Müller", family: "Müller" }],
        year: 2020,
        title: "On the Nature of Things",
      }),
    ).toBe("muller2020nature");
  });

  it("영문이 아닌 이름·제목이면 대체값을 쓴다", () => {
    expect(
      makeCiteKey({ authors: [{ name: "김철수" }], year: 2024, title: "트랜스포머 개요" }),
    ).toBe("anon2024");
    expect(makeCiteKey({ authors: [], title: "" })).toBe("anon");
  });
});

describe("uniqueCiteKey", () => {
  it("겹치면 b, c 를 붙인다", () => {
    const taken = new Set(["he2016deep", "he2016deepb"]);
    expect(uniqueCiteKey("he2016deep", (k) => taken.has(k))).toBe("he2016deepc");
    expect(uniqueCiteKey("new2020key", (k) => taken.has(k))).toBe("new2020key");
  });
});
