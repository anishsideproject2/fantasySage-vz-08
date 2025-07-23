"use client"

export function RedditPostCard({ colors }) {
  return (
    <div
      className="w-full h-72 rounded-lg border p-4 flex flex-col cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        backgroundColor: "#1a1a1b",
        borderColor: colors.lightBorder,
        boxShadow: colors.shadow,
      }}
      onClick={() =>
        window.open(
          "https://www.reddit.com/r/fantasyfootball/comments/1m3gk5u/your_feedback_here_is_helping_me_build_a_better",
          "_blank",
        )
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">r/</span>
          </div>
          <span className="text-white font-medium">fantasyfootball</span>
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="60"
            height="24"
            viewBox="0 0 60 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6"
          >
            <path
              d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 16.568C16.196 17.94 14.132 18.5 12 18.5s-4.196-.56-5.568-1.932c-.293-.293-.293-.768 0-1.061.293-.293.768-.293 1.061 0C8.465 16.479 10.188 17 12 17s3.535-.521 4.507-1.493c.293-.293.768-.293 1.061 0 .293.293.293.768 0 1.061zM9.5 13.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm5 0c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z"
              fill="#FF4500"
            />
            <text x="28" y="16" fill="white" fontSize="12" fontFamily="Arial, sans-serif">
              reddit
            </text>
          </svg>
        </div>
      </div>

      {/* Posted by */}
      <div className="text-gray-400 text-sm mb-2">Posted by u/fantasysage</div>

      {/* Title */}
      <div className="flex-1 mb-4">
        <h3 className="text-white text-base font-medium leading-tight">
          Your feedback here is helping me build a better free draft tool! It now supports uploading FantasyPros ECR to
          compare...
        </h3>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 text-gray-400 text-sm mb-3">
        <div className="flex items-center gap-1">
          <span className="text-orange-500">↑</span>
          <span>54 upvotes</span>
        </div>
        <div className="flex items-center gap-1">
          <span>💬</span>
          <span>Comment</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🔗</span>
          <span>Copy link</span>
        </div>
      </div>

      {/* View Comments Button */}
      <div className="mt-auto">
        <button
          className="w-full py-2 rounded border text-center text-sm font-medium"
          style={{
            backgroundColor: "transparent",
            borderColor: "#FF4500",
            color: "#FF4500",
          }}
        >
          View 27 comments
        </button>
      </div>
    </div>
  )
}
