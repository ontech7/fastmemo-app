// AI features are not available on web/desktop (Tauri).
// llama.rn requires native platform (Android/iOS).

interface Props {
  onVisibilityChange?: (visible: boolean) => void;
}

export default function AICommandBar(_props: Props) {
  return null;
}
