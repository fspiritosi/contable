import { getContactStatement } from "@/actions/contact-statement";
import { notFound } from "next/navigation";
import ContactDetailView from "./contact-detail-view";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, success } = await getContactStatement(id);

    if (!success || !data) {
        notFound();
    }

    return <ContactDetailView data={data} />;
}
