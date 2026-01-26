import { Dialog, DialogAction, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@ontech7/react-native-dialog";

export default function ComplexDialog({
  open,
  adornmentStart = null,
  title,
  description = null,
  confirm,
  cancel = null,
  alternative = null,
  actionsColumn = false,
}) {
  return (
    <Dialog open={open} slideFrom="bottom">
      <DialogHeader>
        <DialogTitle adornmentStart={adornmentStart}>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
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
