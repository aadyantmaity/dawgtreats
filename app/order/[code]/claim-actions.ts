"use server";

import { revalidatePath } from "next/cache";

import { currentAccount } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import { claimOrder } from "@/lib/orders";

// Keeping an order is the one thing on this page that needs an account, so it is the one
// thing that checks for one.
export async function keepOrderAction(orderCode: string): Promise<void> {
  const account = await currentAccount();
  if (!account) throw new DomainError("Sign in first, then try again.");
  await claimOrder(orderCode, account.id);
  revalidatePath(`/order/${orderCode}`);
}
