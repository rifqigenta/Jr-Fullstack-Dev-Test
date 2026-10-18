export function useDownload() {
  const { request } = useApi();

  async function downloadFile(path, filename, query = {}) {
    if (!import.meta.client) return;

    let blob;

    try {
      blob = await request(path, {
        method: "GET",
        query,
        responseType: "blob",
      });
    } catch (error) {
      const data = error?.data;

      if (data instanceof Blob) {
        let message = "Gagal mengunduh file.";

        try {
          const payload = JSON.parse(await data.text());
          message = payload.message || message;
        } catch (err) {
          console.error(err);
        }

        throw new Error(message);
      }

      throw new Error(data?.message || error?.message || "Gagal mengunduh file.");
    }

    if (!(blob instanceof Blob)) {
      throw new Error("Respons download tidak valid.");
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";

    document.body.appendChild(anchor);

    try {
      anchor.click();
    } finally {
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60_000);
    }
  }

  return {
    downloadFile,
  };
}
