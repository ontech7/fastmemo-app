import { Toaster } from "react-hot-toast";

/**
 * Root-level toast host for the web bundle. Renders the \`react-hot-toast\`
 * \`Toaster\` container once at the app root so \`toast(...)\` calls from
 * \`@/utils/toast\` can surface notifications. On native a no-op counterpart
 * is resolved via file-based platform split.
 */
export default function WebToaster() {
  return <Toaster />;
}
