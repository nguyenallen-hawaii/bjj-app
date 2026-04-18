import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      isGymOwner: boolean;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    isGymOwner: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isGymOwner: boolean;
  }
}
