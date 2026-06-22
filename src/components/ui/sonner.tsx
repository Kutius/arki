import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

function useTheme(): "light" | "dark" {
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    const root = document.documentElement
    return root.classList.contains("light") || root.dataset.theme === "light"
      ? "light"
      : "dark"
  })

  React.useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(
        root.classList.contains("light") || root.dataset.theme === "light"
          ? "light"
          : "dark"
      )
    })
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
