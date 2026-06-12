// Removes an image background using the Remove.bg API.
// Falls back to passthrough (returns the original buffer, bgRemoved=false)
// when no REMOVE_BG_API_KEY is configured or the API call fails.
export async function removeBackground(buffer, ext) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return { buffer, bgRemoved: false };
  }

  try {
    const form = new FormData();
    form.append('image_file', new Blob([buffer]), `image.${ext || 'png'}`);
    form.append('size', 'auto');

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { buffer, bgRemoved: false };
    }

    const arrayBuf = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuf), bgRemoved: true };
  } catch (e) {
    return { buffer, bgRemoved: false };
  }
}
