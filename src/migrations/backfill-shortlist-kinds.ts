import mongoose from 'mongoose';
import env from '@/config/env.config';
import Shortlist, {
  SHORTLIST_KINDS,
} from '@/modules/shortlists/shortlist.model';
import ShortlistInvitation from '@/modules/shortlists/shortlist-invitation.model';

const run = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
  const invitedShortlistIds =
    await ShortlistInvitation.distinct('shortlist');
  const teamResult = await Shortlist.updateMany(
    {
      kind: { $exists: false },
      $or: [
        { 'members.0': { $exists: true } },
        { _id: { $in: invitedShortlistIds } },
      ],
    },
    { $set: { kind: SHORTLIST_KINDS.TEAM } },
  );
  const personalResult = await Shortlist.updateMany(
    { kind: { $exists: false } },
    { $set: { kind: SHORTLIST_KINDS.PERSONAL } },
  );
  console.info(
    JSON.stringify(
      {
        teamMatched: teamResult.matchedCount,
        teamUpdated: teamResult.modifiedCount,
        personalMatched: personalResult.matchedCount,
        personalUpdated: personalResult.modifiedCount,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
