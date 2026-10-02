import { motion } from "framer-motion";
import { useUser } from "../../context/UserContext.jsx";
import { PointsCard, UnlockedRewards, earnLine } from "../rewards/RewardsCard.jsx";

/** Account → rewards: the same live card and codes as the Rewards page. */
export default function LoyaltyTab() {
  const { rewards } = useUser();
  const line = earnLine(rewards);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-ink">{rewards.name}</h2>
        {line && <p className="mt-1 text-sm text-ink-soft">Earn {line}.</p>}
      </div>
      <PointsCard />
      <UnlockedRewards />
      <p className="text-sm text-ink-soft">
        See every tier and how to earn on the <a href="/rewards" className="font-semibold text-magenta hover:underline">Rewards page</a>.
      </p>
    </motion.div>
  );
}
