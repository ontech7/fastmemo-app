import { useState } from "react";

interface TimeoutStates {
  loading: {
    get: () => boolean;
    set: (value: boolean) => void;
  };
  error: {
    get: () => boolean;
    set: (value: boolean) => void;
  };
}

interface UseTimeoutTaskReturn {
  timeoutStates: TimeoutStates;
  setTimeoutTask: (callback: () => Promise<void>, timeout: number) => Promise<void>;
}

export const useTimeoutTask = (): UseTimeoutTaskReturn => {
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setError] = useState<boolean>(false);

  const setTimeoutTask = async (callback: () => Promise<void>, timeout: number): Promise<void> => {
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
        set: (value: boolean) => setLoading(value),
      },
      error: {
        get: () => isError,
        set: (value: boolean) => setError(value),
      },
    },
    setTimeoutTask,
  };
};
