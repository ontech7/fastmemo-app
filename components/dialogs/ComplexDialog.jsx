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
        {alternative && alternative.handler && <DialogAction onPress={alternative.handler}>{alternative.label}</DialogAction>}
        {cancel && cancel.handler && <DialogAction onPress={cancel.handler}>{cancel.label}</DialogAction>}
        <DialogAction onPress={confirm.handler}>{confirm.label}</DialogAction>
      </DialogFooter>
    </Dialog>
  );
}
