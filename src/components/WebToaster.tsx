/**
 * Native no-op counterpart of \`WebToaster.web.tsx\`.
 *
 * On native platforms the toast system uses \`react-native-root-toast\` via
 * \`@/utils/toast\`, which renders through \`RootSiblingParent\`, so no root-level
 * Toaster element is needed. This file exists so the layout can import
 * \`WebToaster\` without a platform gate -- Metro resolves the \`.web.tsx\`
 * variant for the web bundle.
 */
export default function WebToaster(): null {
  return null;
}
