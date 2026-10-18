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
  akses: number | bigint | boolean;
  create: number | bigint | boolean;
  read: "All" | "Own" | "No";
  update: "All" | "Own" | "No";
  delete: "All" | "Own" | "No";
};

function enabled(value: number | bigint | boolean): boolean {
  return value === true || Number(value) === 1;
}

function describe(permissions: PermissionRow[]): string {
  const modules = permissions
    .filter((permission) => enabled(permission.akses))
    .map((permission) => {
      const actions: string[] = [];

      if (enabled(permission.create)) actions.push("C");
      if (permission.read !== "No") {
        actions.push(permission.read === "Own" ? "RO" : "R");
      }
      if (permission.update !== "No") {
        actions.push(permission.update === "Own" ? "UO" : "U");
      }
      if (permission.delete !== "No") {
        actions.push(permission.delete === "Own" ? "DO" : "D");
      }

      return `${permission.modul_fitur} (${actions.join(", ") || "akses"})`;
    });

  return modules.length ? modules.join("; ") : "Tidak memiliki akses modul.";
}

export async function getRoles() {
  const [roles, permissions] = await Promise.all([
    pool.query<RoleRow[]>(
      `
        SELECT id, nama_role, created_at
        FROM user_role
        ORDER BY id ASC
      `,
    ),

    pool.query<PermissionRow[]>(
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
        ORDER BY modul_fitur ASC
      `,
    ),
  ]);

  return roles.map((role) => ({
    ...role,
    deskripsi: describe(permissions.filter((permission) => Number(permission.id_role) === Number(role.id))),
  }));
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
    deskripsi: describe(permissions),

    permissions: permissions.map((permission) => ({
      ...permission,
      akses: enabled(permission.akses),
      create: enabled(permission.create),
    })),
  };
}
