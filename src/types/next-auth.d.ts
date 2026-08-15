import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "VIEWER";
    active: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "VIEWER";
      active: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "VIEWER";
    active?: boolean;
  }
}
