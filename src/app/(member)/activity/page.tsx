import { paths } from "@/lib/paths";
import { requireAdminPage } from "@/server/viewer";
import { ActivityList } from "@/features/activity/components/activity-list";
import { ACTIVITY_GROUPS, isActivityGroup, listActivity, type ActivityGroup } from "@/features/activity/queries";
import { Card, CardHeader } from "@/ui/card";
import { PageHeader } from "@/ui/page-header";
import { TabLinks } from "@/ui/tabs";

export const metadata = { title: "ประวัติการแก้ไข" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  await requireAdminPage();
  const { g } = await searchParams;
  const group: ActivityGroup = isActivityGroup(g) ? g : "all";
  const rows = await listActivity({ group, take: 200 });

  return (
    <>
      <PageHeader
        title="ประวัติการแก้ไข"
        back={{ href: paths.settings, label: "ตั้งค่า" }}
        description="ใครทำอะไร เมื่อไหร่ ใช้ตรวจย้อนหลังเวลามีข้อสงสัยเรื่องเงินหรือผลการแข่ง"
      />
      <TabLinks
        current={group}
        tabs={(Object.keys(ACTIVITY_GROUPS) as ActivityGroup[]).map((k) => ({
          key: k,
          label: ACTIVITY_GROUPS[k].label,
          href: paths.activity(k),
        }))}
      />
      <Card>
        <CardHeader title={`${rows.length} รายการล่าสุด`} />
        <ActivityList rows={rows} showSession />
      </Card>
    </>
  );
}
