import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
	"leaderboard snapshot",
	{ minutes: 5 },
	internal.leaderboard.computeSnapshot,
)

export default crons
