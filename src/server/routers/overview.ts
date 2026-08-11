import { overviewTiles } from "../reporting";
import { roleProcedure, router } from "../trpc";

export const overviewRouter = router({
  /** The Phase-1 Director Overview tiles (M1 only, ADR-0006). Director only. */
  tiles: roleProcedure("director").query(({ ctx }) => overviewTiles(ctx.db, ctx.today)),
});
