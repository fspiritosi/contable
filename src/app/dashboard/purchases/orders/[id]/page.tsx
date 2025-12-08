import { notFound } from "next/navigation";
import { getActiveOrganizationId } from "@/lib/organization";
import { getPurchaseOrderDetail } from "@/actions/purchase-orders";
import PurchaseOrderDetailView from "../purchase-order-detail-view";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizationId = await getActiveOrganizationId();
  const { success, data } = await getPurchaseOrderDetail(organizationId, id);

  if (!success || !data) {
    notFound();
  }

  return <PurchaseOrderDetailView order={data} />;
}
