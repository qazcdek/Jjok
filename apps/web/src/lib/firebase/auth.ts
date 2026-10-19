import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { DRIVE_SCOPE, driveTokens } from "../drive";
import { auth } from "./app";
import { ensureUserDoc } from "./users";

/** Google 로그인 + drive.file 동의 (F-6.1). DevDocs/04-security.md §1 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    // Firebase 는 만료 시각을 주지 않는다. Google 액세스 토큰 기본 수명(1시간)으로 둔다.
    driveTokens.set(credential.accessToken, 3600, result.user.email ?? undefined);
  }
  await ensureUserDoc(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  driveTokens.clear();
  await firebaseSignOut(auth);
}

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: auth.currentUser,
    loading: true,
  });
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        driveTokens.setLoginHint(user?.email ?? undefined);
        setState({ user, loading: false });
      }),
    [],
  );
  return state;
}
