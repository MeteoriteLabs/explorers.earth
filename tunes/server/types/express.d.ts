import type { MusicPrincipal } from "../middleware/musicPrincipal";

declare global {
  namespace Express {
    interface Request {
      musicPrincipal?: MusicPrincipal;
    }
  }
}

export {};
