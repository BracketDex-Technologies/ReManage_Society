"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

interface UserSession {
  id?: string;
  name: string;
  role: string;
  email: string;
  flatNumber?: string;
  societyId?: string;
  societyName?: string;
  societyAddress?: string;
  societyUpiId?: string;
  joinCode?: string;
  noFlatLinked?: boolean;
}

interface UserContextValue {
  user: UserSession;
  loaded: boolean;
  refetch: () => void;
}

const defaultUser: UserSession = {
  name: "",
  role: "",
  email: "",
};

const UserContext = createContext<UserContextValue>({
  user: defaultUser,
  loaded: false,
  refetch: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession>(defaultUser);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchUser = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = window.setTimeout(() => setLoaded(true), 10_000);

    fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
            email: data.user.email || "",
            societyId: data.user.societyId,
            societyName: data.user.society?.name,
            societyAddress: data.user.society?.city,
            societyUpiId: data.user.society?.upiId,
            joinCode: data.user.joinCode,
            flatNumber: data.user.flatNumber,
            noFlatLinked: Boolean(data.user.noFlatLinked),
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    fetchUser();
    return () => abortRef.current?.abort();
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{ user, loaded, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
