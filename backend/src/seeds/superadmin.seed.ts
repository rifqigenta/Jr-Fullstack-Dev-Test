import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9\s]/.test(password) || /\s/.test(password)) {
    throw new Error("Password minimal 8 karakter, wajib huruf besar, " + "huruf kecil, simbol, dan tanpa spasi.");
  }

  const roles = await pool.query("SELECT id FROM user_role WHERE nama_role = ?", ["Superadmin"]);

  if (roles.length !== 1) {
    throw new Error("Role Superadmin tidak ditemukan atau duplikat.");
  }

  const username = "superadmin";
  const email = "superadmin@example.com";

  const existing = await pool.query("SELECT id FROM `user` WHERE username = ? OR email = ?", [username, email]);

  if (existing.length > 0) {
    console.log("Akun sudah ada, seed dilewati.");
    return;
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO \`user\` (
      id_role,
      id_pegawai,
      username,
      password_hash,
      nama,
      email,
      disabled
    ) VALUES (?, NULL, ?, ?, ?, ?, 0)`,
    [roles[0].id, username, hash, "Super Administrator", email],
  );

  console.log("Superadmin berhasil dibuat.");
  console.log("Username: superadmin");
  console.log("Email: superadmin@example.com");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
