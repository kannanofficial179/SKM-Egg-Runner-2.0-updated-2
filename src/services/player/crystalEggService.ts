/**
 * SKM EGG RUNNER — Crystal Egg (Gem) Service
 * Manages the crystal egg wallet stored in the users/{uid} document.
 * Crystal eggs are the premium in-game currency used for revives and skins.
 */

import { db } from '../firebase/firebase';
import { getPlayer, updatePlayer } from './playerService';

// ─────────────────────────────────────────────
// getCrystalEggBalance
// ─────────────────────────────────────────────

export async function getCrystalEggBalance(uid: string): Promise<number> {
  const player = await getPlayer(uid);
  return player?.totalCrystalEggs ?? 0;
}

// ─────────────────────────────────────────────
// addCrystalEggs — adds a positive amount to the balance
// ─────────────────────────────────────────────

export async function addCrystalEggs(uid: string, amount: number): Promise<number> {
  if (amount <= 0) throw new Error('[crystalEggService] Amount must be greater than zero.');

  const player = await getPlayer(uid);
  if (!player) throw new Error('[crystalEggService] Player not found.');

  const next = player.totalCrystalEggs + amount;
  await updatePlayer(uid, { totalCrystalEggs: next });
  return next;
}

// ─────────────────────────────────────────────
// removeCrystalEggs — deducts amount; throws if insufficient balance
// ─────────────────────────────────────────────

export async function removeCrystalEggs(uid: string, amount: number): Promise<number> {
  if (amount <= 0) throw new Error('[crystalEggService] Amount must be greater than zero.');

  const player = await getPlayer(uid);
  if (!player) throw new Error('[crystalEggService] Player not found.');

  if (player.totalCrystalEggs < amount) {
    throw new Error(
      `[crystalEggService] Insufficient crystal eggs. Have ${player.totalCrystalEggs}, need ${amount}.`
    );
  }

  const next = player.totalCrystalEggs - amount;
  await updatePlayer(uid, { totalCrystalEggs: next });
  return next;
}
