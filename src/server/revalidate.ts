import { revalidatePath } from "next/cache";
import { paths } from "@/lib/paths";

/** Which pages to refresh after a change. Grouped by what changed, not by which page asked. */
export const refresh = {
  session(id: string) {
    revalidatePath(paths.session(id));
    revalidatePath(paths.sessions);
    revalidatePath(paths.home);
  },
  results() {
    revalidatePath(paths.stats);
  },
  money() {
    revalidatePath(paths.home);
    revalidatePath(paths.finance);
    revalidatePath(paths.me);
  },
  charge(chargeId: string) {
    revalidatePath(paths.pay(chargeId));
  },
  member(id: string) {
    revalidatePath(paths.member(id));
    revalidatePath(paths.members);
    revalidatePath(paths.me);
  },
  /** Group name and other settings appear in every layout. */
  everything() {
    revalidatePath(paths.home, "layout");
  },
};
