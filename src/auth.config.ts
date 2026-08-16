import type { NextAuthConfig } from "next-auth";

/**
 * Config "leve", sem imports de Node (Prisma/bcrypt), para poder rodar no
 * Edge Runtime dentro do middleware. A autenticação de fato (authorize)
 * mora em src/auth.ts, que roda em ambiente Node normal.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.active = user.active;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as "ADMIN" | "VIEWER";
        session.user.active = token.active as boolean;
      }
      return session;
    },
  },
  providers: [],
};
