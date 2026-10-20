// 보안 규칙 필수 케이스: DevDocs/08-test-strategy.md §3
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const ALICE = "alice";
const BOB = "bob";
const base = { schemaVersion: 1 };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // 개발용 demo-jjok 데이터와 섞이지 않게 별도 프로젝트 ID 를 쓴다 (실행 중인 에뮬레이터에 붙여도 안전)
    projectId: "demo-jjok-rules",
    firestore: { rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // 규칙을 우회해 초기 데이터 준비
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { ...base, displayName: "Alice" });
    await setDoc(doc(db, "users/alice/works/w1"), {
      ...base,
      title: "Attention",
      primaryVersionId: "v1",
    });
    await setDoc(doc(db, "users/alice/works/w1/versions/v1"), { ...base, label: "arXiv v1" });
    await setDoc(doc(db, "users/alice/works/w1/versions/v2"), { ...base, label: "NeurIPS 2017" });
    await setDoc(doc(db, "users/alice/apiKeys/openai"), { ciphertext: "xxx" });
    await setDoc(doc(db, "users/alice/meta/llmKeys"), { openai: { last4: "abcd" } });
    await setDoc(doc(db, "users/alice/annotations/a1"), {
      ...base,
      createdBy: "agent",
      status: "suggested",
    });
    await setDoc(doc(db, "citationCache/s2:123"), { title: "Paper" });
  });
});

const asAlice = () => env.authenticatedContext(ALICE).firestore();
const asBob = () => env.authenticatedContext(BOB).firestore();
const asGuest = () => env.unauthenticatedContext().firestore();

describe("인증", () => {
  it("로그인 안 한 사용자는 사용자 데이터를 읽지 못한다", async () => {
    await assertFails(getDoc(doc(asGuest(), "users/alice")));
    await assertFails(getDoc(doc(asGuest(), "users/alice/works/w1")));
  });

  it("로그인 안 한 사용자는 citationCache 도 읽지 못한다", async () => {
    await assertFails(getDoc(doc(asGuest(), "citationCache/s2:123")));
  });
});

describe("사용자 간 격리", () => {
  it("본인 문서와 하위 컬렉션은 읽고 쓸 수 있다", async () => {
    const db = asAlice();
    await assertSucceeds(getDoc(doc(db, "users/alice")));
    await assertSucceeds(getDoc(doc(db, "users/alice/works/w1/versions/v1")));
    await assertSucceeds(setDoc(doc(db, "users/alice/tags/t1"), { ...base, name: "New" }));
    await assertSucceeds(deleteDoc(doc(db, "users/alice/tags/t1")));
  });

  it("다른 사용자의 문서는 읽지도 쓰지도 못한다", async () => {
    const db = asBob();
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(getDoc(doc(db, "users/alice/works/w1")));
    await assertFails(getDoc(doc(db, "users/alice/works/w1/versions/v1")));
    await assertFails(setDoc(doc(db, "users/alice/tags/t9"), { ...base, name: "x" }));
    await assertFails(updateDoc(doc(db, "users/alice"), { displayName: "hacked" }));
  });

  it("users 문서 삭제는 본인도 못 한다", async () => {
    await assertFails(deleteDoc(doc(asAlice(), "users/alice")));
  });
});

describe("BYOK 키", () => {
  it("본인도 apiKeys 를 읽거나 쓰지 못한다", async () => {
    const db = asAlice();
    await assertFails(getDoc(doc(db, "users/alice/apiKeys/openai")));
    await assertFails(setDoc(doc(db, "users/alice/apiKeys/gemini"), { ciphertext: "y" }));
  });

  it("meta/llmKeys 는 본인 읽기만 된다", async () => {
    const db = asAlice();
    await assertSucceeds(getDoc(doc(db, "users/alice/meta/llmKeys")));
    await assertFails(setDoc(doc(db, "users/alice/meta/llmKeys"), { openai: { last4: "zzzz" } }));
  });

  it("다른 사용자는 meta/llmKeys 를 읽지 못한다", async () => {
    await assertFails(getDoc(doc(asBob(), "users/alice/meta/llmKeys")));
  });
});

describe("컬렉션 목록과 스키마", () => {
  it("목록에 없는 하위 컬렉션에는 쓰지 못한다", async () => {
    await assertFails(setDoc(doc(asAlice(), "users/alice/secrets/x"), { ...base }));
    await assertFails(setDoc(doc(asAlice(), "users/alice/meta/other"), { ...base }));
  });

  it("schemaVersion 이 없거나 정수가 아니면 쓰지 못한다", async () => {
    const db = asAlice();
    await assertFails(setDoc(doc(db, "users/alice/tags/t3"), { name: "no version" }));
    await assertFails(setDoc(doc(db, "users/alice/tags/t3"), { schemaVersion: "1", name: "x" }));
  });
});

describe("agent 생성 문서", () => {
  it("클라이언트는 createdBy: agent 문서를 만들지 못한다", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/links/l1"), { ...base, createdBy: "agent" }),
    );
  });

  it("agent 제안의 status 는 바꿀 수 있지만 createdBy 는 바꿀 수 없다", async () => {
    const ref = doc(asAlice(), "users/alice/annotations/a1");
    await assertSucceeds(updateDoc(ref, { status: "active" }));
    await assertFails(updateDoc(ref, { createdBy: "user" }));
  });
});

describe("citationCache", () => {
  it("로그인 사용자는 읽을 수 있고, 쓰기는 거부된다", async () => {
    await assertSucceeds(getDoc(doc(asBob(), "citationCache/s2:123")));
    await assertFails(setDoc(doc(asBob(), "citationCache/s2:999"), { title: "fake" }));
  });
});

describe("작품과 대표 버전 (F-1.4.1)", () => {
  const work = (primaryVersionId?: string) => ({ ...base, title: "W", primaryVersionId });

  it("작품과 대표 버전을 한 배치로 만들 수 있다", async () => {
    const db = asAlice();
    const batch = writeBatch(db);
    batch.set(doc(db, "users/alice/works/w2"), work("v1"));
    batch.set(doc(db, "users/alice/works/w2/versions/v1"), { ...base, label: "업로드" });
    await assertSucceeds(batch.commit());
  });

  it("대표 버전이 없거나 존재하지 않는 판을 가리키면 작품을 만들 수 없다", async () => {
    const db = asAlice();
    await assertFails(setDoc(doc(db, "users/alice/works/w2"), { ...base, title: "W" }));
    await assertFails(setDoc(doc(db, "users/alice/works/w2"), work("nope")));
  });

  it("없는 작품 아래에는 판을 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/works/ghost/versions/v1"), { ...base, label: "x" }),
    );
  });

  it("대표 버전은 존재하는 판으로만 바꿀 수 있다", async () => {
    const ref = doc(asAlice(), "users/alice/works/w1");
    await assertSucceeds(updateDoc(ref, { primaryVersionId: "v2" }));
    await assertFails(updateDoc(ref, { primaryVersionId: "nope" }));
  });

  it("대표 버전은 지울 수 없고, 다른 판은 지울 수 있다", async () => {
    const db = asAlice();
    await assertFails(deleteDoc(doc(db, "users/alice/works/w1/versions/v1")));
    await assertSucceeds(deleteDoc(doc(db, "users/alice/works/w1/versions/v2")));
  });

  it("대표를 바꾸면서 이전 대표 판을 같은 배치로 지울 수 있다", async () => {
    const db = asAlice();
    const batch = writeBatch(db);
    batch.update(doc(db, "users/alice/works/w1"), { primaryVersionId: "v2" });
    batch.delete(doc(db, "users/alice/works/w1/versions/v1"));
    await assertSucceeds(batch.commit());
  });

  it("작품과 모든 판을 함께 지울 수 있다", async () => {
    const db = asAlice();
    const batch = writeBatch(db);
    batch.delete(doc(db, "users/alice/works/w1/versions/v1"));
    batch.delete(doc(db, "users/alice/works/w1/versions/v2"));
    batch.delete(doc(db, "users/alice/works/w1"));
    await assertSucceeds(batch.commit());
  });

  it("다른 사용자는 대표 버전을 바꾸지 못한다", async () => {
    await assertFails(updateDoc(doc(asBob(), "users/alice/works/w1"), { primaryVersionId: "v2" }));
  });
});
