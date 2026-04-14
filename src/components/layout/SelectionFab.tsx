import { useTranslation } from "react-i18next"
import { Copy, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"

interface SelectionFabProps {
  count: number
  label?: string
  onCopy: () => void
  onClear: () => void
}

export function SelectionFab({ count, label = "个", onCopy, onClear }: SelectionFabProps) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <span className="text-sm">
            {t("toolbar.selected", { count })} {label}
          </span>
          <Button size="sm" onClick={onCopy}>
            <Copy className="size-3" />
            {t("toolbar.copySelected")}
          </Button>
          <Button size="sm" variant="destructive" onClick={onClear}>
            <X className="size-3" />
            {t("tags.clear")}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
