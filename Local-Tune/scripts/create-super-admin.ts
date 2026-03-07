import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";

async function createSuperAdmin() {
  const username = "yapral27";
  const plainPassword = "Cosmic@Admin2025";  // Strong password with mix of characters
  const venueName = "Super Admin";

  try {
    // Check if super admin already exists
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      console.log("Super admin already exists:", existing.id);
      process.exit(0);
    }

    const hashedPassword = await hashPassword(plainPassword);

    // Create super admin user
    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      venueName,
    });

    console.log("Super admin created with id:", newUser.id);
    console.log("Super admin credentials:");
    console.log("Username:", username);
    console.log("Password:", plainPassword);
    process.exit(0);
  } catch (error) {
    console.error("Failed to create super admin:", error);
    process.exit(1);
  }
}

createSuperAdmin();