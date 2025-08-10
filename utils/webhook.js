AbortSignal.timeout ??= function timeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
};

export const webhook = async (payload, body = {}) => {
  if (!payload || !payload.enabled || !payload.url) {
    return;
  }

  try {
    await fetch(payload.url, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        ...body,
      }),
    });
  } catch (err) {
    console.log(err);
  }
};
