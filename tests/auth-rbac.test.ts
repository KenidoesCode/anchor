import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/pg";
import * as s from "@/db/schema";
import { recentActivity } from "@/server/activity";
import { authenticate, createSession, hashPassword, resolveSession } from "@/server/auth";
import { callerFor, fakeUser } from "./helpers/caller";
import { seedGateWorld, type GateFixture } from "./helpers/fixtures";
import { makeTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;
let fx: GateFixture;

beforeEach(async () => {
  ({ db, close } = await makeTestDb());
  fx = await seedGateWorld(db);
});
afterEach(async () => {
  await close();
});

function input(personId: string) {
  return {
    personId,
    roleId: fx.roleWshoId,
    organisationId: fx.orgId,
    siteId: fx.siteId,
    startDate: "2026-09-01",
    endDate: "2026-12-31" as string | null,
  };
}

describe("authentication (Slice 2)", () => {
  it("authenticates a valid credential and resolves the session", async () => {
    const [u] = await db
      .insert(s.appUser)
      .values({
        email: "coord@greensafe.test",
        fullName: "Coord",
        role: "deployment_coordinator",
        passwordHash: hashPassword("greensafe"),
      })
      .returning({ id: s.appUser.id });

    expect(await authenticate(db, "coord@greensafe.test", "wrong")).toBeNull();
    const user = await authenticate(db, "coord@greensafe.test", "greensafe");
    expect(user?.role).toBe("deployment_coordinator");

    const token = await createSession(db, u!.id);
    expect((await resolveSession(db, token))?.email).toBe("coord@greensafe.test");
    expect(await resolveSession(db, "not-a-token")).toBeNull();
  });

  it("expired sessions do not resolve", async () => {
    const [u] = await db
      .insert(s.appUser)
      .values({ email: "x@greensafe.test", fullName: "X", role: "director", passwordHash: hashPassword("p") })
      .returning({ id: s.appUser.id });
    const past = new Date(Date.now() - 1000);
    await db.insert(s.session).values({ id: "expired-token", userId: u!.id, expiresAt: past });
    expect(await resolveSession(db, "expired-token")).toBeNull();
  });
});

describe("server-side authorisation (UXF §2.1)", () => {
  it("rejects an unauthenticated caller with UNAUTHORIZED", async () => {
    const caller = callerFor(db, null);
    await expect(caller.assignment.validate(input(fx.validPersonId))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lets a Deployment Coordinator create an assignment", async () => {
    const caller = callerFor(db, fakeUser("deployment_coordinator"));
    const created = await caller.assignment.create(input(fx.validPersonId));
    expect(created.result.outcome).toBe("confirmed");
  });

  it("forbids a Deployed Officer from creating an assignment", async () => {
    const caller = callerFor(db, fakeUser("deployed_officer"));
    await expect(caller.assignment.create(input(fx.validPersonId))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("forbids a non-Director from reading the activity log", async () => {
    const caller = callerFor(db, fakeUser("deployment_coordinator"));
    await expect(caller.activity.recent()).rejects.toBeInstanceOf(TRPCError);
    const director = callerFor(db, fakeUser("director"));
    await expect(director.activity.recent()).resolves.toBeInstanceOf(Array);
  });

  it("still enforces the gate for an authorised role (lapsed cert blocked)", async () => {
    const caller = callerFor(db, fakeUser("deployment_coordinator"));
    await expect(caller.assignment.create(input(fx.lapsedPersonId))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("activity log (PRD §10.5)", () => {
  it("records the assignment create as an append-only event", async () => {
    const caller = callerFor(db, fakeUser("deployment_coordinator", { personId: null }));
    await caller.assignment.create(input(fx.validPersonId));
    const log = await recentActivity(db);
    expect(log.some((e) => e.action === "assignment.create")).toBe(true);
  });
});
