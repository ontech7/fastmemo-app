import { useState } from "react";

export const useTimeoutTask = () => {
  const [isLoading, setLoading] = useState(true);
  const [isError, setError] = useState(false);

  const setTimeoutTask = async (callback, timeout) => {
    setError(false);
    setLoading(true);

    const t = setTimeout(async () => {
      setError(true);
      setLoading(false);
    }, timeout);

    await callback();

    clearTimeout(t);

    setLoading(false);
  };

  return {
    timeoutStates: {
      loading: {
        get: () => isLoading,
        set: (value) => setLoading(value),
      },
      error: {
        get: () => isError,
        set: (value) => setError(value),
      },
    },
    setTimeoutTask,
  };
};
