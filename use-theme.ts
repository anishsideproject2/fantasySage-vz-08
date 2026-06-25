"use client"

import { useState, useEffect } from "react"

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [modernUiEnabled, setModernUiEnabled] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem("fantasy-theme") as "light" | "dark"
    if (savedTheme) {
      setTheme(savedTheme)
    }

    setModernUiEnabled(localStorage.getItem("fantasy-modern-ui") === "true")
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("fantasy-theme", newTheme)
  }

  const toggleModernUi = () => {
    const nextValue = !modernUiEnabled
    setModernUiEnabled(nextValue)
    localStorage.setItem("fantasy-modern-ui", String(nextValue))
  }

  return { theme, toggleTheme, modernUiEnabled, toggleModernUi }
}
