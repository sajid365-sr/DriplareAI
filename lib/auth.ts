import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

export async function getAndSyncUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  // Sync user with DB
  // If user exists with this userId, update it.
  // If not, but exists with this email, update the userId (migration).
  // Otherwise, create new.
  
  const existingByUserId = await db.user.findUnique({ where: { userId } });
  
  if (existingByUserId) {
    return existingByUserId;
  }

  const existingByEmail = await db.user.findUnique({ where: { email } });

  if (existingByEmail) {
    // Migrate old user to Clerk userId
    return await db.user.update({
      where: { email },
      data: { userId },
    });
  }

  // Create new user
  return await db.user.create({
    data: {
      userId,
      email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
      picture: user.imageUrl,
    },
  });
}
