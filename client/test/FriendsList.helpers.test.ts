import { strict as assert } from "node:assert";
import test from "node:test";

import {
  friendFromAcceptedPayload,
  focusFriendEntity,
  sortFriendsForDisplay,
} from "../src/ui/components/FriendsList.helpers.ts";

test("sortFriendsForDisplay groups online friends first and sorts each group by name", () => {
  const friends = [
    { id: "4", name: "Ben", avatar: "", isOnline: false },
    { id: "2", name: "zoe", avatar: "", isOnline: true },
    { id: "3", name: "Ada", avatar: "", isOnline: false },
    { id: "1", name: "amy", avatar: "", isOnline: true },
  ];

  const sorted = sortFriendsForDisplay(friends);

  assert.deepEqual(
    sorted.map((friend) => friend.name),
    ["amy", "zoe", "Ada", "Ben"],
  );
  assert.deepEqual(
    friends.map((friend) => friend.name),
    ["Ben", "zoe", "Ada", "amy"],
  );
});

test("friendFromAcceptedPayload maps protocol friend.accepted payloads into Friend objects", () => {
  assert.deepEqual(friendFromAcceptedPayload({ by: "p2", byName: "李雷" }), {
    id: "p2",
    name: "李雷",
    avatar: "",
    isOnline: true,
  });
});

test("focusFriendEntity emits a focus command and opens the profile target", () => {
  const emitted: Array<{ event: string; payload: { id: string } }> = [];
  let profileTarget: string | null = null;

  focusFriendEntity(
    "friend-online-amy",
    (id) => {
      profileTarget = id;
    },
    (event, payload) => {
      emitted.push({ event, payload });
    },
  );

  assert.deepEqual(emitted, [
    { event: "focus-entity", payload: { id: "friend-online-amy" } },
  ]);
  assert.equal(profileTarget, "friend-online-amy");
});
