import { pool } from "../../config/database.js";

type RoleRow = {
  id: number;
  nama_role: string;
  created_at: Date;
};

type PermissionRow = {
  id: number;
  id_role: number;
  modul_fitur: string;
  akses: number | boolean;
  create: number | boolean;
  read: "All" | "Own" | "No";
  update: "All" | "Own" | "No";
  delete: "All" | "Own" | "No";
};

export async function getRoles() {
  const roles = await pool.query<RoleRow[]>(
    `
    SELECT id, nama_role, created_at
    FROM user_role
    ORDER BY id ASC
    `,
  );

  return roles;
}

export async function getRolePermissions(roleId: number) {
  const roles = await pool.query<RoleRow[]>(
    `
    SELECT id, nama_role, created_at
    FROM user_role
    WHERE id = ?
    LIMIT 1
    `,
    [roleId],
  );

  const role = roles[0];

  if (!role) return null;

  const permissions = await pool.query<PermissionRow[]>(
    `
    SELECT
      id,
      id_role,
      modul_fitur,
      akses,
      \`create\`,
      \`read\`,
      \`update\`,
      \`delete\`
    FROM role_permission
    WHERE id_role = ?
    ORDER BY modul_fitur ASC
    `,
    [roleId],
  );

  return {
    ...role,
    permissions: permissions.map((permission) => ({
      ...permission,
      akses: Boolean(permission.akses),
      create: Boolean(permission.create),
    })),
  };
}
