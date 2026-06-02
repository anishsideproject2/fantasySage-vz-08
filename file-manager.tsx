"use client"
import { useState } from "react"
import { Upload, FileText, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FileManager({
  colors,
  rankings,
  setRankings,
  activeRankingIndex,
  setActiveRankingIndex,
  handleFileUpload,
  isPapaParseLoaded,
}) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e, index) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const mockEvent = { target: { files } }
      handleFileUpload(mockEvent, index)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const removeRanking = (index) => {
    const newRankings = [...rankings]
    newRankings[index] = { data: [], name: null }
    setRankings(newRankings)
    if (activeRankingIndex === index && newRankings[1 - index].data.length > 0) {
      setActiveRankingIndex(1 - index)
    }
  }

  const toggleActiveRanking = () => {
    const otherIndex = 1 - activeRankingIndex
    if (rankings[otherIndex].data.length > 0) {
      setActiveRankingIndex(otherIndex)
    }
  }

  const hasMultipleRankings = rankings[0].data.length > 0 && rankings[1].data.length > 0

  return (
    <div className="space-y-4">
      {/* File Upload Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rankings.map((ranking, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                Rankings {index + 1} {index === activeRankingIndex && ranking.data.length > 0 && "(Active)"}
              </label>
              {ranking.data.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRanking(index)}
                  className="h-6 w-6 p-0 hover:bg-red-500/20"
                >
                  <Trash2 size={12} className="text-red-500" />
                </Button>
              )}
            </div>

            <div
              className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
                dragOver ? "border-blue-400 bg-blue-50/10" : "border-gray-300"
              }`}
              style={{
                borderColor: ranking.data.length > 0 ? colors.purple : colors.cardBorder,
                backgroundColor: ranking.data.length > 0 ? `${colors.purple}10` : colors.card,
              }}
              onDrop={(e) => handleDrop(e, index)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e, index)}
                disabled={!isPapaParseLoaded}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="text-center">
                {ranking.data.length > 0 ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={20} style={{ color: colors.purple }} />
                    <div>
                      <div className="font-medium" style={{ color: colors.textPrimary }}>
                        {ranking.name || `Rankings ${index + 1}`}
                      </div>
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        {ranking.data.length} players loaded
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={24} style={{ color: colors.textSecondary }} />
                    <div>
                      <div className="font-medium" style={{ color: colors.textPrimary }}>
                        Drop CSV file here
                      </div>
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        or click to browse
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle Between Rankings - Made Larger */}
      {hasMultipleRankings && (
        <div className="flex items-center justify-center gap-4 p-4 rounded-lg" style={{ backgroundColor: colors.card }}>
          <span
            className={`text-base font-medium ${activeRankingIndex === 0 ? "opacity-100" : "opacity-50"}`}
            style={{ color: colors.textPrimary }}
          >
            {rankings[0].name || "Rankings 1"}
          </span>
          <button onClick={toggleActiveRanking} className="p-2 rounded hover:bg-gray-200/20 transition-colors">
            {activeRankingIndex === 0 ? (
              <ToggleLeft size={36} style={{ color: colors.purple }} />
            ) : (
              <ToggleRight size={36} style={{ color: colors.purple }} />
            )}
          </button>
          <span
            className={`text-base font-medium ${activeRankingIndex === 1 ? "opacity-100" : "opacity-50"}`}
            style={{ color: colors.textPrimary }}
          >
            {rankings[1].name || "Rankings 2"}
          </span>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs space-y-1" style={{ color: colors.textSecondary }}>
        <p>• Upload Underdog, FantasyPros ECR, or any CSV with player data</p>
        <p>• Supports Underdog format (firstName, lastName, slotName, adp columns)</p>
        <p>• Compare different ranking sources by uploading to both slots</p>
        <p>• Toggle between rankings to see different perspectives on player values</p>
      </div>
    </div>
  )
}
