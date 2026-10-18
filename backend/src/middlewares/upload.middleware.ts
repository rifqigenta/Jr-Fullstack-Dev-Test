import multer from "multer";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const uploadEmployeePhoto = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 0,
    parts: 1,
  },
}).single("photo");
