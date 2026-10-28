import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ontech7/react-native-dialog";
import { ReactNode } from "react";

import { KEEP_DIALOG_TOUCHES } from "@/components/dialogs/keepDialogTouches";

interface DialogActionConfig {
  label: string;
  handler: () => void;
  adornment?: ReactNode;
}

interface Props {
  open: boolean;
  adornmentStart?: ReactNode;
  title: string;
  description?: string | null;
  confirm: DialogActionConfig;
  cancel?: DialogActionConfig | null;
  alternative?: DialogActionConfig | null;
  actionsColumn?: boolean;
  /** Called when the user taps outside the dialog (backdrop). Omit to make it non-dismissible. */
  onDismiss?: (() => void) | null;
  /** Content between the description and the actions (a list, a progress bar). */
  children?: ReactNode;
}

export default function ComplexDialog({
  open,
  adornmentStart = null,
  title,
  description = null,
  confirm,
  cancel = null,
  alternative = null,
  actionsColumn = false,
  onDismiss = null,
  children = null,
}: Props) {
  return (
    <Dialog open={open} slideFrom="center" onPressOut={onDismiss ?? undefined} {...KEEP_DIALOG_TOUCHES}>
      <DialogHeader>
        <DialogTitle adornmentStart={adornmentStart}>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children && <DialogBody>{children}</DialogBody>}
      <DialogFooter style={[actionsColumn && { flexDirection: "column", alignItems: "flex-end" }]}>
        {cancel && cancel.handler && (
          <DialogAction onPress={cancel.handler} adornmentEnd={cancel.adornment}>
            {cancel.label}
          </DialogAction>
        )}
        <DialogAction onPress={confirm.handler} adornmentEnd={confirm.adornment}>
          {confirm.label}
        </DialogAction>
        {alternative && alternative.handler && (
          <DialogAction onPress={alternative.handler} adornmentEnd={alternative.adornment}>
            {alternative.label}
          </DialogAction>
        )}
      </DialogFooter>
    </Dialog>
  );
}
